import type {
  VolcanoArkApiKeyScope,
  VolcanoInterfaceMetadata,
} from "./volcano-snapshot";

export type { VolcanoArkApiKeyScope };

export function collectVolcanoArkEndpointIds(
  metadata: Pick<VolcanoInterfaceMetadata, "arkEndpoints">
): readonly string[] {
  if (!metadata.arkEndpoints) {
    return [];
  }
  return [...new Set(Object.values(metadata.arkEndpoints))];
}

/**
 * Resolve the `model` field for Volcano chat/inference requests.
 * Endpoint-scoped IAM keys require `ep-*`; console/raw keys use provider ModelId.
 */
export function resolveVolcanoInferenceModelId(params: {
  readonly canonicalId: string;
  readonly providerModelId: string;
  readonly metadata: Pick<
    VolcanoInterfaceMetadata,
    "arkEndpoints" | "arkApiKeyScope"
  >;
}): string {
  if (params.metadata.arkApiKeyScope === "endpoint") {
    const endpointId = params.metadata.arkEndpoints?.[params.canonicalId];
    if (endpointId) {
      return endpointId;
    }
  }

  return params.providerModelId;
}

/** Move legacy per-model endpointId into interface-level arkEndpoints. */
export function normalizeVolcanoArkEndpoints(
  metadata: VolcanoInterfaceMetadata
): VolcanoInterfaceMetadata {
  const arkEndpoints = { ...(metadata.arkEndpoints ?? {}) };
  let changed = false;

  for (const [canonicalId, config] of Object.entries(metadata.models)) {
    const legacyEndpointId = (config as { readonly endpointId?: string })
      .endpointId;
    if (!legacyEndpointId || arkEndpoints[canonicalId]) {
      continue;
    }
    arkEndpoints[canonicalId] = legacyEndpointId;
    changed = true;
  }

  if (!changed && metadata.arkEndpoints) {
    return metadata;
  }

  if (!changed) {
    return metadata;
  }

  return {
    ...metadata,
    arkEndpoints,
  };
}
