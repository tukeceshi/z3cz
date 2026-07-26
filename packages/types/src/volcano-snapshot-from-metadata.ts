import { VOLCANO_AI_MODEL_CATALOG } from "./ai-model-catalog";
import type { OrganizationAiInterface } from "./ai-interface";
import {
  VOLCANO_MODEL_PRICING_CATALOG,
  VOLCANO_PRICING_EFFECTIVE_DATE,
} from "./volcano-pricing-catalog";
import { readPackageListCache } from "./volcano-package-list-cache";
import { buildUsageMapsFromPackageRows } from "./volcano-package-usage-map";
import { resolveVolcanoEffectiveActivationStatus } from "./volcano-effective-activation";
import {
  VOLCANO_TOS_DEFAULT_PREFIX,
} from "./volcano-tos-regions";
import type {
  VolcanoApiKeyStatus,
  VolcanoInterfaceMetadata,
  VolcanoSnapshotResponse,
} from "./volcano-snapshot";
import type { VolcanoResourcePackageRow } from "./volcano-resource-package-usage";
import { buildTosPackageUsageFromRows } from "./volcano-tos-package-usage";
import { volcanoTosPricingForRegion } from "./volcano-tos-pricing";

const VOLCANO_PRICING_DOC_URL =
  "https://docs.volcengine.com/docs/82379/1544106?lang=zh" as const;
const VOLCANO_API_KEY_RENEW_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

function isVolcanoMetadata(
  metadata: OrganizationAiInterface["metadata"]
): metadata is VolcanoInterfaceMetadata {
  return (
    metadata !== null &&
    metadata !== undefined &&
    typeof metadata === "object" &&
    "credentialMode" in metadata &&
    metadata.credentialMode === "volcengine_iam"
  );
}

function getVolcanoApiKeyStatus(
  expiresAt: string | null | undefined,
  renewFailed = false
): VolcanoApiKeyStatus {
  if (renewFailed) return "renew_failed";
  if (!expiresAt) return "expired";
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return "expired";
  if (expiresMs <= Date.now()) return "expired";
  if (expiresMs - Date.now() < VOLCANO_API_KEY_RENEW_THRESHOLD_MS) {
    return "expiring_soon";
  }
  return "active";
}

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

function buildTosStorageSnapshot(params: {
  readonly metadata: VolcanoInterfaceMetadata;
  readonly packageRows: readonly VolcanoResourcePackageRow[];
}): NonNullable<VolcanoSnapshotResponse["tosStorage"]> {
  const config = params.metadata.tosStorage;
  const region = config?.region?.trim() ?? "";
  const bucket = config?.bucket?.trim() ?? "";
  const configured = Boolean(region && bucket);
  const enabled = config?.enabled === true && configured;
  const { storageUsage, trafficUsage } = buildTosPackageUsageFromRows(
    params.packageRows
  );
  const pricing = region ? volcanoTosPricingForRegion(region) : undefined;

  return {
    enabled,
    configured,
    region,
    bucket,
    prefix: VOLCANO_TOS_DEFAULT_PREFIX,
    storageUsage,
    trafficUsage,
    pricing: pricing ?? undefined,
  };
}

export function hasVolcanoPackageListCache(
  iface: OrganizationAiInterface
): boolean {
  if (!isVolcanoMetadata(iface.metadata)) {
    return false;
  }
  return readPackageListCache(iface.metadata) !== null;
}

export function buildVolcanoSnapshotFromMetadata(
  iface: OrganizationAiInterface
): VolcanoSnapshotResponse | null {
  if (!isVolcanoMetadata(iface.metadata)) {
    return null;
  }

  const metadata = iface.metadata;
  const cache = readPackageListCache(metadata);
  const packageRows = cache?.rows ?? [];
  const packageListCachedAt = cache?.fetchedAt;
  const { usageByModel, packageByModel } = buildUsageMapsFromPackageRows(
    packageRows,
    VOLCANO_AI_MODEL_CATALOG
  );
  const activationCache = metadata.modelActivationCache ?? {};

  const models = VOLCANO_AI_MODEL_CATALOG.map((entry) => {
    const config = metadata.models[entry.canonicalId];
    const enabled = config?.enabled ?? false;
    const packageSnapshot = packageByModel.get(entry.canonicalId) ?? null;
    const activationCacheEntry = activationCache[entry.canonicalId] ?? null;
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

    return {
      canonicalId: entry.canonicalId,
      alias: entry.alias,
      modality: entry.modality,
      providerModelId: entry.providerModelId,
      enabled,
      activation,
      package: packageSnapshot,
      usage: usageByModel.get(entry.canonicalId) ?? null,
    };
  });

  const keyPending = metadata.arkApiKeyPending === true && !iface.hasApiKey;

  return {
    fetchedAt: packageListCachedAt ?? "",
    apiKey: {
      masked: "••••••••",
      expiresAt: metadata.arkApiKeyExpiresAt ?? null,
      status: getVolcanoApiKeyStatus(
        metadata.arkApiKeyExpiresAt,
        keyPending
      ),
    },
    balance: null,
    ...(packageListCachedAt ? { packageListCachedAt } : {}),
    pricing: buildPricingSection(),
    models,
    tosStorage: buildTosStorageSnapshot({ metadata, packageRows }),
  };
}
