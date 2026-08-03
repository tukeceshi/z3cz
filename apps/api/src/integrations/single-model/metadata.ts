import {
  isSingleModelProviderMetadata,
  mergeSingleModelModelAlias,
  mergeSingleModelModelEnabled,
  mergeSingleModelUpstreamModelIds,
  type SingleModelProviderMetadata,
} from "@dafthunk/types";

export function parseSingleModelMetadata(
  raw: unknown
): SingleModelProviderMetadata | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return isSingleModelProviderMetadata(raw) ? raw : null;
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
