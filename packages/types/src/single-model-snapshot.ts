import { VOLCANO_AI_MODEL_CATALOG } from "./ai-model-catalog";
import type { OrganizationAiInterface } from "./ai-interface";
import type { AiModelModality } from "./ai-model-catalog";
import {
  isSingleModelProviderMetadata,
  type SingleModelModelConfig,
  type SingleModelProviderMetadata,
} from "./single-model-interface-metadata";

export interface SingleModelSnapshotRow {
  readonly canonicalId: string;
  readonly alias: string;
  readonly modality: AiModelModality;
  readonly upstreamModelId: string;
  readonly enabled: boolean;
}

export interface SingleModelSnapshotResponse {
  readonly models: readonly SingleModelSnapshotRow[];
}

function catalogAliasFor(canonicalId: string): string {
  return (
    VOLCANO_AI_MODEL_CATALOG.find((entry) => entry.canonicalId === canonicalId)
      ?.alias ?? canonicalId
  );
}

export function buildSingleModelSnapshotFromMetadata(
  metadata: SingleModelProviderMetadata
): SingleModelSnapshotResponse {
  const models = Object.entries(metadata.models).map(([canonicalId, config]) => ({
    canonicalId,
    alias: catalogAliasFor(canonicalId),
    modality: config.modality,
    upstreamModelId: config.upstreamModelId,
    enabled: config.enabled,
  }));

  return { models };
}

export function buildSingleModelSnapshotFromInterface(
  iface: OrganizationAiInterface
): SingleModelSnapshotResponse | null {
  if (!iface.metadata || !isSingleModelProviderMetadata(iface.metadata)) {
    return null;
  }
  return buildSingleModelSnapshotFromMetadata(iface.metadata);
}

export function listEnabledSingleModelSnapshotRows(
  snapshot: SingleModelSnapshotResponse
): readonly SingleModelSnapshotRow[] {
  return snapshot.models.filter((row) => row.enabled);
}

export type { SingleModelModelConfig };
