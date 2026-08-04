import type {
  AiModelModality,
  PlatformAiModel,
  PlatformAiModelGroup,
  PlatformCatalogModelOption,
} from "@dafthunk/types";

import type { Database } from "../db";
import {
  listPlatformAiModelGroups,
  listPlatformAiModels,
} from "../db/platform-ai-model-queries";

function mapPlatformCatalogModel(
  model: PlatformAiModel,
  group: PlatformAiModelGroup | undefined
): PlatformCatalogModelOption {
  return {
    canonicalId: model.canonicalId,
    displayName: model.displayName,
    modality: model.modality as AiModelModality,
    description: model.description,
    groupId: model.groupId,
    groupName: group?.name ?? null,
    groupDescription: group?.description ?? null,
    groupIcon: group?.icon ?? null,
  };
}

export async function listPlatformCatalogModelOptions(
  db: Database,
  modality: AiModelModality
): Promise<readonly PlatformCatalogModelOption[]> {
  const [platformModels, groups] = await Promise.all([
    listPlatformAiModels(db, modality),
    listPlatformAiModelGroups(db, modality),
  ]);

  const groupById = new Map(groups.map((group) => [group.id, group]));
  const visibleModels = platformModels.filter((model) => model.platformEnabled);

  return visibleModels.map((model) =>
    mapPlatformCatalogModel(
      model,
      model.groupId ? groupById.get(model.groupId) : undefined
    )
  );
}
