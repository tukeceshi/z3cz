import type {
  AiModelModality,
  PlatformAiModel,
  PlatformCatalogModelOption,
} from "@dafthunk/types";

import type { Database } from "../db";
import { listPlatformAiModels } from "../db/platform-ai-model-queries";

function mapPlatformCatalogModel(model: PlatformAiModel): PlatformCatalogModelOption {
  return {
    canonicalId: model.canonicalId,
    displayName: model.displayName,
    modality: model.modality as AiModelModality,
    description: model.description,
    sortOrder: model.sortOrder,
    brandIcon: model.brandIcon,
  };
}

export async function listPlatformCatalogModelOptions(
  db: Database,
  modality: AiModelModality
): Promise<readonly PlatformCatalogModelOption[]> {
  const platformModels = await listPlatformAiModels(db, modality);
  const visibleModels = platformModels.filter((model) => model.platformEnabled);

  return visibleModels.map(mapPlatformCatalogModel);
}
