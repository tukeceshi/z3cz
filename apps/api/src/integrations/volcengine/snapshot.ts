import {
  VOLCANO_MODEL_PRICING_CATALOG,
  VOLCANO_PRICING_EFFECTIVE_DATE,
  resolveInterfaceModelAlias,
  type VolcanoModelUsage,
  type VolcanoResourcePackageRow,
  type VolcanoSnapshotResponse,
} from "@dafthunk/types";

import type { Bindings } from "../../context";
import { createDatabase } from "../../db";
import { listAggregateVolcanoCatalogEntries } from "../../db/platform-ai-model-channel-queries";
import {
  getOrganizationAiInterfaceRow,
  updateOrganizationAiInterface,
} from "../../db/ai-interface-queries";
import {
  ensureVolcanoApiKey,
  getVolcanoApiKeyStatus,
  getVolcanoCredentials,
  maskApiKey,
} from "./ensure-api-key";
import { isVolcanoArkApiKeyPending } from "./deferred-api-key";
import {
  ensureVolcanoModelsIncludePlatformCatalog,
} from "../../services/resolve-text-model-interface";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
  pruneVolcanoMetadataToCatalog,
  serializeInterfaceMetadata,
} from "./metadata";
import { VOLCANO_PRICING_DOC_URL } from "./constants";
import { queryVolcanoBalance } from "./query-balance";
import { VolcengineApiRequestError } from "./client";
import {
  buildUsageMapsFromPackageRows,
  resolveVolcanoPackageRows,
} from "./resolve-package-rows";
import { resolveVolcanoEffectiveActivationStatus } from "./resolve-volcano-activation";
import { queryTosBucketStorageGiB } from "./query-tos-bucket-storage";
import { buildVolcanoTosStorageSnapshot } from "./tos-storage-snapshot";

function buildPricingSection(): VolcanoSnapshotResponse["pricing"] {
  return {
    docUrl: VOLCANO_PRICING_DOC_URL,
    effectiveDate: VOLCANO_PRICING_EFFECTIVE_DATE,
    rows: VOLCANO_MODEL_PRICING_CATALOG.map((row) => ({
      canonicalId: row.canonicalId,
      alias: row.alias,
      modality: row.modality,
      unitLabel: row.unitLabel,
      priceLabel: row.priceLabel,
      inputPriceLabel: row.inputPriceLabel,
      outputPriceLabel: row.outputPriceLabel,
      pricingNotes: row.pricingNotes,
    })),
  };
}

export async function buildVolcanoSnapshot(params: {
  env: Bindings;
  organizationId: string;
  interfaceId: string;
  refreshPackages?: boolean;
}): Promise<{
  snapshot: VolcanoSnapshotResponse;
  refreshLimited?: boolean;
  nextRefreshAt?: string;
}> {
  const db = createDatabase(params.env);
  const row = await getOrganizationAiInterfaceRow(
    db,
    params.organizationId,
    params.interfaceId
  );
  if (!row) {
    throw new Error("AI interface not found");
  }

  const metadata = parseInterfaceMetadata(row.metadata);
  if (!isVolcanoMetadata(metadata)) {
    throw new Error("AI interface is not a Volcano configuration");
  }

  const ensured = await ensureVolcanoApiKey({
    env: params.env,
    organizationId: params.organizationId,
    metadataRaw: row.metadata,
    apiKeyEncrypted: row.apiKeyEncrypted,
  });

  if (ensured.renewed || ensured.metadataChanged) {
    await updateOrganizationAiInterface(db, params.organizationId, row.id, {
      metadata: ensured.metadataRaw,
      ...(ensured.renewed ? { apiKeyEncrypted: ensured.apiKeyEncrypted } : {}),
    });
  }

  const credentials = await getVolcanoCredentials(
    params.env,
    params.organizationId,
    ensured.metadataRaw
  );
  if (!credentials) {
    throw new Error("Volcano credentials not configured");
  }

  let refreshedMetadata = parseInterfaceMetadata(ensured.metadataRaw);
  if (!isVolcanoMetadata(refreshedMetadata)) {
    throw new Error("Volcano metadata not configured");
  }

  const aggregateCatalog = await listAggregateVolcanoCatalogEntries(db);
  const alignedMetadata = pruneVolcanoMetadataToCatalog(
    ensureVolcanoModelsIncludePlatformCatalog(
      refreshedMetadata,
      aggregateCatalog
    ),
    aggregateCatalog
  );
  if (
    JSON.stringify(alignedMetadata.models) !==
    JSON.stringify(refreshedMetadata.models)
  ) {
    refreshedMetadata = alignedMetadata;
    await updateOrganizationAiInterface(db, params.organizationId, row.id, {
      metadata: serializeInterfaceMetadata(alignedMetadata),
    });
  } else {
    refreshedMetadata = alignedMetadata;
  }

  let usageByModel = new Map<string, VolcanoModelUsage | null>();
  let packageByModel = new Map<
    string,
    NonNullable<VolcanoSnapshotResponse["models"][number]["package"]>
  >();
  let usageFetchError: string | undefined;
  let packageListCachedAt: string | undefined;
  let packageRows: VolcanoResourcePackageRow[] = [];
  let refreshLimited = false;
  let nextRefreshAt: string | undefined;

  try {
    const resolved = await resolveVolcanoPackageRows({
      credentials,
      metadata: refreshedMetadata,
      refreshPackages: params.refreshPackages === true,
      onMetadataCacheUpdate: async (nextMetadata) => {
        refreshedMetadata = nextMetadata;
        await updateOrganizationAiInterface(db, params.organizationId, row.id, {
          metadata: serializeInterfaceMetadata(nextMetadata),
        });
      },
    });

    const maps = buildUsageMapsFromPackageRows(resolved.rows);
    usageByModel = maps.usageByModel;
    packageByModel = maps.packageByModel;
    packageRows = [...resolved.rows];
    usageFetchError = resolved.usageFetchError;
    packageListCachedAt = resolved.packageListCachedAt;
    refreshLimited = resolved.refreshLimited === true;
    nextRefreshAt = resolved.nextRefreshAt;
  } catch (error) {
    usageFetchError =
      error instanceof VolcengineApiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to fetch resource packages";
    const cached = refreshedMetadata.packageListCache?.rows;
    if (cached?.length) {
      packageRows = [...cached];
    }
  }

  const activationCache = refreshedMetadata.modelActivationCache ?? {};

  const modelCatalogById = new Map(
    aggregateCatalog.map((entry) => [entry.canonicalId, entry])
  );
  const modelRows = [...modelCatalogById.values()].map((entry) => {
    const config = refreshedMetadata.models[entry.canonicalId];
    const enabled = config?.enabled ?? false;
    const activationCacheEntry = activationCache[entry.canonicalId] ?? null;
    const packageSnapshot = packageByModel.get(entry.canonicalId) ?? null;
    const effectiveStatus = resolveVolcanoEffectiveActivationStatus({
      probe: activationCacheEntry,
      packageSnapshot,
      canonicalId: entry.canonicalId,
    });
    const activation =
      effectiveStatus !== null
        ? {
            status: effectiveStatus,
            probedAt:
              activationCacheEntry?.probedAt ??
              packageListCachedAt ??
              new Date().toISOString(),
            errorCode: activationCacheEntry?.errorCode ?? null,
            message: activationCacheEntry?.message ?? null,
          }
        : activationCacheEntry;
    const base = {
      canonicalId: entry.canonicalId,
      alias: resolveInterfaceModelAlias({
        alias: config?.alias,
        platformDisplayName: entry.alias,
      }),
      modality: entry.modality,
      providerModelId: entry.providerModelId,
      enabled,
      activation,
      package: packageSnapshot,
    };

    if (!enabled) {
      return {
        ...base,
        usage: usageByModel.get(entry.canonicalId) ?? null,
      };
    }

    if (usageFetchError) {
      return {
        ...base,
        usage: null,
        usageError: usageFetchError,
      };
    }

    return {
      ...base,
      usage: usageByModel.get(entry.canonicalId) ?? null,
    };
  });

  let balance: VolcanoSnapshotResponse["balance"] = null;
  let balanceError: string | undefined;
  let bucketStorageGiB: number | undefined;
  let bucketStorageError: string | undefined;
  const tosConfig = refreshedMetadata.tosStorage;
  const tosEnabled =
    tosConfig?.enabled === true &&
    Boolean(tosConfig.region?.trim() && tosConfig.bucket?.trim());

  if (!refreshLimited) {
    try {
      balance = await queryVolcanoBalance({ credentials });
    } catch (error) {
      balanceError =
        error instanceof Error ? error.message : "Failed to fetch balance";
    }

    if (tosEnabled) {
      try {
        const bucketStorage = await queryTosBucketStorageGiB({
          credentials,
          bucket: tosConfig!.bucket,
          region: tosConfig!.region,
        });
        if (bucketStorage) {
          bucketStorageGiB = bucketStorage.storageGiB;
        } else {
          bucketStorageError = "Bucket storage metrics unavailable";
        }
      } catch (error) {
        bucketStorageError =
          error instanceof VolcengineApiRequestError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to fetch bucket storage metrics";
      }
    }
  }

  const ensuredMetadata = parseInterfaceMetadata(ensured.metadataRaw);
  const keyPending =
    isVolcanoMetadata(ensuredMetadata) &&
    isVolcanoArkApiKeyPending(ensuredMetadata, ensured.apiKey || null);

  return {
    snapshot: {
      fetchedAt: packageListCachedAt ?? new Date().toISOString(),
      apiKey: {
        masked: maskApiKey(ensured.apiKey),
        expiresAt: ensured.expiresAt,
        status: getVolcanoApiKeyStatus(
          ensured.expiresAt,
          !ensured.apiKey && keyPending
        ),
      },
      balance,
      ...(balanceError ? { balanceError } : {}),
      ...(usageFetchError ? { usageError: usageFetchError } : {}),
      ...(packageListCachedAt ? { packageListCachedAt } : {}),
      pricing: buildPricingSection(),
      models: modelRows,
      tosStorage: buildVolcanoTosStorageSnapshot({
        metadata: refreshedMetadata,
        packageRows,
        usageError: usageFetchError,
        bucketStorageGiB,
        bucketStorageError,
      }),
    },
    ...(refreshLimited ? { refreshLimited: true } : {}),
    ...(nextRefreshAt ? { nextRefreshAt } : {}),
  };
}
