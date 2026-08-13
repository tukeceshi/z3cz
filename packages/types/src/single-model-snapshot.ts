import { VOLCANO_AI_MODEL_CATALOG } from "./ai-model-catalog";
import type { OrganizationAiInterface } from "./ai-interface";
import type { AiModelModality } from "./ai-model-catalog";
import { resolveInterfaceModelAlias } from "./org-model-label";
import {
  isSingleModelProviderMetadata,
  type SingleModelModelConfig,
  type SingleModelProviderMetadata,
} from "./single-model-interface-metadata";
import {
  listSingleModelMetadataEntries,
} from "./single-model-instances";

export interface SingleModelSnapshotRow {
  readonly instanceId: string;
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
  const models = listSingleModelMetadataEntries(metadata).map(
    ({ instanceId, config, canonicalId }) => ({
      instanceId,
      canonicalId,
      alias: resolveInterfaceModelAlias({
        alias: config.alias,
        platformDisplayName: catalogAliasFor(canonicalId),
      }),
      modality: config.modality,
      upstreamModelId: config.upstreamModelId,
      enabled: config.enabled,
    })
  );

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
