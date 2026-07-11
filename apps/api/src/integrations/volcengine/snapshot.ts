import {
  VOLCANO_AI_MODEL_CATALOG,
  VOLCANO_MODEL_PRICING_CATALOG,
  VOLCANO_PRICING_EFFECTIVE_DATE,
  type VolcanoModelUsage,
  type VolcanoSnapshotResponse,
} from "@dafthunk/types";

import type { Bindings } from "../../context";
import { createDatabase } from "../../db";
import {
  getOrganizationAiInterfaceRow,
  updateOrganizationAiInterface,
} from "../../db/ai-interface-queries";
import { buildVolcanoPackageUsageMap } from "./aggregate-package-usage";
import {
  ensureVolcanoApiKey,
  getVolcanoApiKeyStatus,
  getVolcanoCredentials,
  maskApiKey,
} from "./ensure-api-key";
import { fetchAllVolcanoResourcePackages } from "./list-resource-packages";
import { isVolcanoMetadata, parseInterfaceMetadata } from "./metadata";
import { VOLCANO_PRICING_DOC_URL } from "./constants";
import { queryVolcanoBalance } from "./query-balance";
import { VolcengineApiRequestError } from "./client";
import { indexResourcePackagesByConfigurationCode } from "./parse-resource-packages";

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
}): Promise<VolcanoSnapshotResponse> {
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

  if (ensured.renewed) {
    await updateOrganizationAiInterface(db, params.organizationId, row.id, {
      metadata: ensured.metadataRaw,
      apiKeyEncrypted: ensured.apiKeyEncrypted,
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

  const refreshedMetadata = parseInterfaceMetadata(ensured.metadataRaw);
  if (!isVolcanoMetadata(refreshedMetadata)) {
    throw new Error("Volcano metadata not configured");
  }

  let usageByModel = new Map<string, VolcanoModelUsage | null>();
  let packageByModel = new Map<
    string,
    NonNullable<VolcanoSnapshotResponse["models"][number]["package"]>
  >();
  let usageFetchError: string | undefined;

  try {
    const packages = await fetchAllVolcanoResourcePackages({
      credentials,
    });
    const packagesByCode = indexResourcePackagesByConfigurationCode(packages);
    const aggregated = buildVolcanoPackageUsageMap({
      catalog: VOLCANO_AI_MODEL_CATALOG,
      packagesByCode,
    });
    usageByModel = aggregated.usageByCanonicalId;
    packageByModel = aggregated.packageByCanonicalId;
  } catch (error) {
    usageFetchError =
      error instanceof VolcengineApiRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to fetch resource packages";
  }

  const activationCache = refreshedMetadata.modelActivationCache ?? {};

  const modelRows = VOLCANO_AI_MODEL_CATALOG.map((entry) => {
    const config = refreshedMetadata.models[entry.canonicalId];
    const enabled = config?.enabled ?? false;
    const activation = activationCache[entry.canonicalId] ?? null;
    const packageSnapshot = packageByModel.get(entry.canonicalId) ?? null;
    const base = {
      canonicalId: entry.canonicalId,
      alias: entry.alias,
      modality: entry.modality,
      providerModelId: entry.providerModelId,
      enabled,
      activation,
      package: packageSnapshot,
    };

    if (!enabled) {
      return {
        ...base,
        usage: null,
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
  try {
    balance = await queryVolcanoBalance({ credentials });
  } catch (error) {
    balanceError =
      error instanceof Error ? error.message : "Failed to fetch balance";
  }

  return {
    fetchedAt: new Date().toISOString(),
    apiKey: {
      masked: maskApiKey(ensured.apiKey),
      expiresAt: ensured.expiresAt,
      status: getVolcanoApiKeyStatus(ensured.expiresAt),
    },
    balance,
    ...(balanceError ? { balanceError } : {}),
    ...(usageFetchError ? { usageError: usageFetchError } : {}),
    pricing: buildPricingSection(),
    models: modelRows,
  };
}
