import {
  isSingleModelProviderMetadata,
  mergeSingleModelCapabilityLimitsByCanonicalId,
  mergeSingleModelEndpointRules,
  mergeSingleModelFormatTransformsByCanonicalId,
  mergeSingleModelModelAlias,
  mergeSingleModelModelEnabled,
  mergeSingleModelUpstreamModelIds,
  normalizeOrgModelInstancesMap,
  type SingleModelCapabilityLimits,
  type SingleModelFormatTransform,
  type SingleModelProviderMetadata,
} from "@dafthunk/types";

export function parseSingleModelMetadata(
  raw: unknown
): SingleModelProviderMetadata | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  if (!isSingleModelProviderMetadata(raw)) {
    return null;
  }
  return {
    ...raw,
    models: normalizeOrgModelInstancesMap(raw.models),
  };
}

export function serializeSingleModelMetadata(
  metadata: SingleModelProviderMetadata
): string {
  return JSON.stringify(metadata);
}

export function mergeSingleModelModelEnabledMetadata(
  metadata: SingleModelProviderMetadata,
  toggles: Readonly<Record<string, boolean>>
): SingleModelProviderMetadata {
  return mergeSingleModelModelEnabled(metadata, toggles);
}

export function mergeSingleModelUpstreamModelIdsMetadata(
  metadata: SingleModelProviderMetadata,
  updates: Readonly<Record<string, string>>
): SingleModelProviderMetadata {
  return mergeSingleModelUpstreamModelIds(metadata, updates);
}

export function mergeSingleModelModelAliasMetadata(
  metadata: SingleModelProviderMetadata,
  aliases: Readonly<Record<string, string>>
): SingleModelProviderMetadata {
  return mergeSingleModelModelAlias(metadata, aliases);
}

export function mergeSingleModelEndpointRulesMetadata(
  metadata: SingleModelProviderMetadata,
  rules: SingleModelProviderMetadata["endpointRules"]
): SingleModelProviderMetadata {
  return mergeSingleModelEndpointRules(metadata, rules);
}

export function mergeSingleModelFormatTransformsMetadata(
  metadata: SingleModelProviderMetadata,
  updates: Readonly<Record<string, SingleModelFormatTransform | null | undefined>>
): SingleModelProviderMetadata {
  return mergeSingleModelFormatTransformsByCanonicalId(metadata, updates);
}

export function mergeSingleModelCapabilityLimitsMetadata(
  metadata: SingleModelProviderMetadata,
  updates: Readonly<Record<string, SingleModelCapabilityLimits | null | undefined>>
): SingleModelProviderMetadata {
  return mergeSingleModelCapabilityLimitsByCanonicalId(metadata, updates);
}

export function mergeSingleModelModelsMetadata(
  metadata: SingleModelProviderMetadata,
  models: SingleModelProviderMetadata["models"]
): SingleModelProviderMetadata {
  return { ...metadata, models };
}
