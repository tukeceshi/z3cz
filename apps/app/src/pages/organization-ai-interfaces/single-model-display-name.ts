import {
  VOLCANO_AI_MODEL_CATALOG,
  type SingleModelPresetEntry,
} from "@dafthunk/types";

import type { TranslationKey } from "@/i18n";

export function resolveSingleModelPresetCardName(
  preset: SingleModelPresetEntry,
  _t: (key: TranslationKey) => string
): string {
  return preset.name;
}

export function resolveDeepSeekModelCardName(
  canonicalId: string,
  platformDisplayName?: string | null
): string {
  const trimmedPlatformName = platformDisplayName?.trim();
  if (trimmedPlatformName) {
    return trimmedPlatformName;
  }

  const catalogEntry = VOLCANO_AI_MODEL_CATALOG.find(
    (entry) => entry.canonicalId === canonicalId
  );
  return catalogEntry?.alias ?? canonicalId;
}

export function resolveDefaultInterfaceListName(params: {
  readonly preset?: SingleModelPresetEntry;
  readonly canonicalId?: string;
  readonly platformDisplayName?: string | null;
  readonly t: (key: TranslationKey) => string;
}): string {
  if (params.preset) {
    return resolveSingleModelPresetCardName(params.preset, params.t);
  }

  if (params.canonicalId) {
    return resolveDeepSeekModelCardName(
      params.canonicalId,
      params.platformDisplayName
    );
  }

  return "";
}
