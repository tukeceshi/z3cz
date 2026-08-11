import { useMemo } from "react";

import type { PlatformAiModelChannelOption } from "@dafthunk/types";

import { usePlatformModelChannels } from "@/services/platform-ai-model-service";

interface PlatformCatalogModelLike {
  readonly canonicalId: string;
}

export function buildApiPresetChannelIdMap(
  channels: readonly PlatformAiModelChannelOption[]
): ReadonlyMap<string, ReadonlySet<string>> {
  const byPreset = new Map<string, Set<string>>();

  for (const channel of channels) {
    if (channel.channel !== "api") {
      continue;
    }
    const ids = byPreset.get(channel.presetId) ?? new Set<string>();
    ids.add(channel.canonicalId);
    byPreset.set(channel.presetId, ids);
  }

  return byPreset;
}

export function listPresetEnabledModelIds(
  presetChannelIds: ReadonlyMap<string, ReadonlySet<string>>,
  presetId: string,
  platformModels: readonly PlatformCatalogModelLike[]
): readonly string[] {
  const ids = presetChannelIds.get(presetId);
  if (!ids) {
    return [];
  }

  return platformModels
    .filter((model) => ids.has(model.canonicalId))
    .map((model) => model.canonicalId);
}

export function listPresetAvailableModels<T extends PlatformCatalogModelLike>(
  presetChannelIds: ReadonlyMap<string, ReadonlySet<string>>,
  presetId: string,
  platformModels: readonly T[]
): readonly T[] {
  const ids = presetChannelIds.get(presetId);
  if (!ids) {
    return [];
  }

  return platformModels.filter((model) => ids.has(model.canonicalId));
}

export function useApiPresetChannelIdMap(organizationId: string | undefined) {
  const { channels } = usePlatformModelChannels(organizationId);

  return useMemo(() => buildApiPresetChannelIdMap(channels), [channels]);
}

export function usePresetChannelModelIds(
  organizationId: string | undefined,
  presetId: string,
  platformModels: readonly PlatformCatalogModelLike[]
) {
  const presetChannelIds = useApiPresetChannelIdMap(organizationId);

  return useMemo(
    () => listPresetEnabledModelIds(presetChannelIds, presetId, platformModels),
    [platformModels, presetChannelIds, presetId]
  );
}

export function usePresetChannelCardVisible(
  organizationId: string | undefined,
  presetId: string,
  platformModels: readonly PlatformCatalogModelLike[],
  filterActive: boolean
) {
  const enabledIds = usePresetChannelModelIds(
    organizationId,
    presetId,
    platformModels
  );

  return {
    show: filterActive && enabledIds.length > 0,
    enabledIds,
  };
}
