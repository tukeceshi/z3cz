import {
  VOLCANO_ARK_API_KEY_DURATION_SECONDS,
  VOLCANO_AGGREGATE_MODEL_CATALOG,
  normalizeVolcanoArkEndpoints,
  type AiModelCatalogEntry,
  type VolcanoActivationProbeResult,
  type VolcanoInterfaceMetadata,
  type VolcanoModelConfig,
} from "@dafthunk/types";

import { VOLCANO_DEFAULT_REGION } from "./constants";

export function isVolcanoMetadata(
  metadata: unknown
): metadata is VolcanoInterfaceMetadata {
  if (!metadata || typeof metadata !== "object") return false;
  const value = metadata as VolcanoInterfaceMetadata;
  return (
    value.credentialMode === "volcengine_iam" &&
    typeof value.accessKeyId === "string" &&
    typeof value.secretAccessKeyEncrypted === "string" &&
    typeof value.models === "object"
  );
}

export function buildDefaultVolcanoModels(
  enabledCanonicalIds?: readonly string[],
  catalogEntries: readonly AiModelCatalogEntry[] = VOLCANO_AGGREGATE_MODEL_CATALOG
): Record<string, VolcanoModelConfig> {
  const catalog =
    catalogEntries.length > 0 ? catalogEntries : VOLCANO_AGGREGATE_MODEL_CATALOG;
  const enabledSet = new Set(
    enabledCanonicalIds ?? catalog.map((entry) => entry.canonicalId)
  );

  return Object.fromEntries(
    catalog.map((entry) => [
      entry.canonicalId,
      {
        enabled: enabledSet.has(entry.canonicalId),
        providerModelId: entry.providerModelId,
        modality: entry.modality,
      },
    ])
  );
}

export function createVolcanoMetadata(params: {
  accessKeyId: string;
  secretAccessKeyEncrypted: string;
  enabledModels?: readonly string[];
  arkApiKeyExpiresAt?: string;
  /** Prefer platform_ai_models (union with static catalog). */
  catalogEntries?: readonly AiModelCatalogEntry[];
}): VolcanoInterfaceMetadata {
  const catalog = mergeCatalogEntries(
    VOLCANO_AGGREGATE_MODEL_CATALOG,
    params.catalogEntries
  );
  return {
    credentialMode: "volcengine_iam",
    accessKeyId: params.accessKeyId,
    secretAccessKeyEncrypted: params.secretAccessKeyEncrypted,
    arkApiKeyDurationSeconds: VOLCANO_ARK_API_KEY_DURATION_SECONDS,
    arkApiKeyExpiresAt: params.arkApiKeyExpiresAt,
    region: VOLCANO_DEFAULT_REGION,
    models: buildDefaultVolcanoModels(params.enabledModels, catalog),
  };
}

function mergeCatalogEntries(
  base: readonly AiModelCatalogEntry[],
  extra?: readonly AiModelCatalogEntry[]
): readonly AiModelCatalogEntry[] {
  if (!extra || extra.length === 0) return base;
  const byId = new Map(base.map((entry) => [entry.canonicalId, entry]));
  for (const entry of extra) {
    byId.set(entry.canonicalId, entry);
  }
  return [...byId.values()];
}

export function pruneVolcanoMetadataToCatalog(
  metadata: VolcanoInterfaceMetadata,
  catalogEntries: readonly AiModelCatalogEntry[] = VOLCANO_AGGREGATE_MODEL_CATALOG
): VolcanoInterfaceMetadata {
  const catalog = mergeCatalogEntries(
    VOLCANO_AGGREGATE_MODEL_CATALOG,
    catalogEntries
  );
  const models = buildDefaultVolcanoModels(undefined, catalog);
  for (const entry of catalog) {
    const existing = metadata.models[entry.canonicalId];
    if (existing) {
      models[entry.canonicalId] = existing;
    }
  }

  const catalogIds = new Set(catalog.map((entry) => entry.canonicalId));
  const modelActivationCache = metadata.modelActivationCache
    ? Object.fromEntries(
        Object.entries(metadata.modelActivationCache).filter(([canonicalId]) =>
          catalogIds.has(canonicalId)
        )
      )
    : undefined;

  return {
    ...metadata,
    models,
    ...(modelActivationCache !== undefined ? { modelActivationCache } : {}),
  };
}

export function mergeVolcanoModelEnabled(
  metadata: VolcanoInterfaceMetadata,
  toggles: Readonly<Record<string, boolean>>,
  catalogEntries?: readonly AiModelCatalogEntry[]
): VolcanoInterfaceMetadata {
  const catalog = mergeCatalogEntries(
    VOLCANO_AGGREGATE_MODEL_CATALOG,
    catalogEntries
  );
  const catalogById = new Map(
    catalog.map((entry) => [entry.canonicalId, entry])
  );
  const models = { ...metadata.models };
  for (const [canonicalId, enabled] of Object.entries(toggles)) {
    const existing = models[canonicalId];
    if (existing) {
      models[canonicalId] = { ...existing, enabled };
      continue;
    }
    const catalogEntry = catalogById.get(canonicalId);
    if (!catalogEntry) continue;
    models[canonicalId] = {
      enabled,
      providerModelId: catalogEntry.providerModelId,
      modality: catalogEntry.modality,
    };
  }
  return pruneVolcanoMetadataToCatalog({ ...metadata, models }, catalogEntries);
}

export function mergeVolcanoActivationCache(
  metadata: VolcanoInterfaceMetadata,
  results: readonly VolcanoActivationProbeResult[],
  catalogEntries?: readonly AiModelCatalogEntry[]
): VolcanoInterfaceMetadata {
  const cache = { ...(metadata.modelActivationCache ?? {}) };
  for (const result of results) {
    cache[result.canonicalId] = {
      status: result.status,
      probedAt: result.probedAt,
      errorCode: result.errorCode,
      message: result.message,
    };
  }
  return pruneVolcanoMetadataToCatalog(
    {
      ...metadata,
      modelActivationCache: cache,
    },
    catalogEntries
  );
}

export function resolveVolcanoCatalogEntries(
  canonicalIds?: readonly string[],
  catalogEntries?: readonly AiModelCatalogEntry[]
): readonly AiModelCatalogEntry[] {
  const catalog = mergeCatalogEntries(
    VOLCANO_AGGREGATE_MODEL_CATALOG,
    catalogEntries
  );
  if (!canonicalIds || canonicalIds.length === 0) {
    return catalog;
  }
  const idSet = new Set(canonicalIds);
  return catalog.filter((entry) => idSet.has(entry.canonicalId));
}

export function parseInterfaceMetadata(
  raw:
    | string
    | VolcanoInterfaceMetadata
    | Readonly<Record<string, unknown>>
    | null
    | undefined
): VolcanoInterfaceMetadata | Record<string, unknown> | null {
  if (raw == null) return null;
  // listOrganizationAiInterfaces already returns parsed objects — do not re-parse.
  if (typeof raw === "object") {
    return normalizeVolcanoInterfaceMetadata(
      raw as VolcanoInterfaceMetadata | Record<string, unknown>
    );
  }
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    return normalizeVolcanoInterfaceMetadata(
      JSON.parse(raw) as VolcanoInterfaceMetadata | Record<string, unknown>
    );
  } catch {
    return null;
  }
}

export function normalizeVolcanoInterfaceMetadata(
  metadata: VolcanoInterfaceMetadata | Record<string, unknown> | null
): VolcanoInterfaceMetadata | Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object") {
    return metadata;
  }
  if (!isVolcanoMetadata(metadata)) {
    return metadata;
  }
  return normalizeVolcanoArkEndpoints(metadata);
}

export function serializeInterfaceMetadata(
  metadata: VolcanoInterfaceMetadata | Record<string, unknown>
): string {
  return JSON.stringify(metadata);
}
