import {
  VOLCANO_AI_MODEL_CATALOG,
  VOLCANO_ARK_API_KEY_DURATION_SECONDS,
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
  enabledCanonicalIds?: readonly string[]
): Record<string, VolcanoModelConfig> {
  const enabledSet = new Set(
    enabledCanonicalIds ?? VOLCANO_AI_MODEL_CATALOG.map((entry) => entry.canonicalId)
  );

  return Object.fromEntries(
    VOLCANO_AI_MODEL_CATALOG.map((entry) => [
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
}): VolcanoInterfaceMetadata {
  return {
    credentialMode: "volcengine_iam",
    accessKeyId: params.accessKeyId,
    secretAccessKeyEncrypted: params.secretAccessKeyEncrypted,
    arkApiKeyDurationSeconds: VOLCANO_ARK_API_KEY_DURATION_SECONDS,
    arkApiKeyExpiresAt: params.arkApiKeyExpiresAt,
    region: VOLCANO_DEFAULT_REGION,
    models: buildDefaultVolcanoModels(params.enabledModels),
  };
}

export function mergeVolcanoModelEnabled(
  metadata: VolcanoInterfaceMetadata,
  toggles: Readonly<Record<string, boolean>>
): VolcanoInterfaceMetadata {
  const models = { ...metadata.models };
  for (const [canonicalId, enabled] of Object.entries(toggles)) {
    if (!models[canonicalId]) continue;
    models[canonicalId] = { ...models[canonicalId], enabled };
  }
  return { ...metadata, models };
}

export function mergeVolcanoActivationCache(
  metadata: VolcanoInterfaceMetadata,
  results: readonly VolcanoActivationProbeResult[]
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
  return { ...metadata, modelActivationCache: cache };
}

export function resolveVolcanoCatalogEntries(
  canonicalIds?: readonly string[]
): readonly AiModelCatalogEntry[] {
  if (!canonicalIds || canonicalIds.length === 0) {
    return VOLCANO_AI_MODEL_CATALOG;
  }
  const idSet = new Set(canonicalIds);
  return VOLCANO_AI_MODEL_CATALOG.filter((entry) =>
    idSet.has(entry.canonicalId)
  );
}

export function parseInterfaceMetadata(
  raw: string | null
): VolcanoInterfaceMetadata | Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VolcanoInterfaceMetadata | Record<string, unknown>;
  } catch {
    return null;
  }
}

export function serializeInterfaceMetadata(
  metadata: VolcanoInterfaceMetadata | Record<string, unknown>
): string {
  return JSON.stringify(metadata);
}
