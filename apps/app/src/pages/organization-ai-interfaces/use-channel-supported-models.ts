import {
  getSingleModelPresetsByCategory,
  isExternalBrandOnlyCanonicalId,
} from "@dafthunk/types";
import { useMemo } from "react";

import {
  useOrgAudioModels,
  useOrgImageModels,
  useOrgTextModels,
  useOrgVideoModels,
} from "@/services/platform-ai-model-service";

interface PlatformModelLike {
  readonly canonicalId: string;
  readonly displayName: string;
}

function collectIndependentPresetCanonicalIds(): ReadonlySet<string> {
  const grouped = getSingleModelPresetsByCategory();
  const ids = new Set<string>();
  for (const category of ["text", "image", "video", "audio"] as const) {
    for (const preset of grouped[category]) {
      if (preset.canonicalId) {
        ids.add(preset.canonicalId);
      }
    }
  }
  return ids;
}

const INDEPENDENT_PRESET_CANONICAL_IDS = collectIndependentPresetCanonicalIds();

function mergePlatformModels(
  lists: readonly (readonly PlatformModelLike[])[]
): readonly PlatformModelLike[] {
  const byCanonicalId = new Map<string, PlatformModelLike>();
  for (const list of lists) {
    for (const model of list) {
      byCanonicalId.set(model.canonicalId, model);
    }
  }
  return [...byCanonicalId.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

function displayNamesFor(
  models: readonly PlatformModelLike[],
  predicate: (canonicalId: string) => boolean
): readonly string[] {
  return models.filter((model) => predicate(model.canonicalId)).map(
    (model) => model.displayName
  );
}

export function useChannelSupportedModels(organizationId: string | undefined) {
  const { models: textModels } = useOrgTextModels(organizationId);
  const { models: imageModels } = useOrgImageModels(organizationId);
  const { models: videoModels } = useOrgVideoModels(organizationId);
  const { models: audioModels } = useOrgAudioModels(organizationId);

  return useMemo(() => {
    const allModels = mergePlatformModels([
      textModels,
      imageModels,
      videoModels,
      audioModels,
    ]);

    const volcanoModelNames = displayNamesFor(
      allModels,
      (canonicalId) => !isExternalBrandOnlyCanonicalId(canonicalId)
    );

    const singleModelNames = displayNamesFor(allModels, (canonicalId) => {
      if (isExternalBrandOnlyCanonicalId(canonicalId)) {
        return true;
      }
      return INDEPENDENT_PRESET_CANONICAL_IDS.has(canonicalId);
    });

    return {
      volcanoModelNames,
      singleModelNames,
    };
  }, [audioModels, imageModels, textModels, videoModels]);
}
