import type { VolcanoInterfaceMetadata } from "./volcano-snapshot";

export const VOLCANO_MEDIKIT_CONSOLE_URL =
  "https://docs.volcengine.com/imp/ai-mediakit" as const;

export type VolcanoMediaKitVideoEnhanceMode = "fast" | "standard" | "pro" | "llm";

export const VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES: readonly VolcanoMediaKitVideoEnhanceMode[] =
  ["fast", "standard", "pro", "llm"] as const;

export type VolcanoMediaKitSubtitleEraseMode = "standard" | "refined";

export const VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES: readonly VolcanoMediaKitSubtitleEraseMode[] =
  ["standard", "refined"] as const;

export interface VolcanoMediaKitVideoEnhanceModes {
  readonly fast: boolean;
  readonly standard: boolean;
  readonly pro: boolean;
  readonly llm: boolean;
}

export interface VolcanoMediaKitSubtitleEraseModes {
  readonly standard: boolean;
  readonly refined: boolean;
}

export interface VolcanoMediaKitConfig {
  readonly enabled: boolean;
  readonly videoEnhance: VolcanoMediaKitVideoEnhanceModes;
  readonly subtitleErase: VolcanoMediaKitSubtitleEraseModes;
}

export interface VolcanoMediaKitSnapshot {
  readonly enabled: boolean;
  readonly videoEnhance: VolcanoMediaKitVideoEnhanceModes;
  readonly subtitleErase: VolcanoMediaKitSubtitleEraseModes;
}

/** @deprecated Legacy metadata/request shape */
export interface VolcanoMediaKitEnhanceConfig {
  readonly enabled: boolean;
  readonly modes: VolcanoMediaKitVideoEnhanceModes;
}

/** @deprecated Alias for VolcanoMediaKitSnapshot without subtitleErase */
export type VolcanoMediaKitEnhanceSnapshot = VolcanoMediaKitConfig;

export type VolcanoMediaKitEnhanceMode = VolcanoMediaKitVideoEnhanceMode;

export const VOLCANO_MEDIKIT_ENHANCE_MODES = VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES;

export const VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODE_LABEL_KEYS: Readonly<
  Record<VolcanoMediaKitVideoEnhanceMode, string>
> = {
  fast: "pages.aiInterfaces.mediaKitEnhance.modes.fast",
  standard: "pages.aiInterfaces.mediaKitEnhance.modes.standard",
  pro: "pages.aiInterfaces.mediaKitEnhance.modes.pro",
  llm: "pages.aiInterfaces.mediaKitEnhance.modes.llm",
};

export const VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODE_LABEL_KEYS: Readonly<
  Record<VolcanoMediaKitSubtitleEraseMode, string>
> = {
  standard: "pages.aiInterfaces.mediaKitEnhance.subtitleEraseModes.standard",
  refined: "pages.aiInterfaces.mediaKitEnhance.subtitleEraseModes.refined",
};

/** @deprecated */
export const VOLCANO_MEDIKIT_ENHANCE_MODE_LABEL_KEYS =
  VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODE_LABEL_KEYS;

function createDefaultVideoEnhanceModes(): VolcanoMediaKitVideoEnhanceModes {
  return {
    fast: false,
    standard: false,
    pro: false,
    llm: false,
  };
}

function createDefaultSubtitleEraseModes(): VolcanoMediaKitSubtitleEraseModes {
  return {
    standard: false,
    refined: false,
  };
}

export function createDefaultVolcanoMediaKitConfig(): VolcanoMediaKitConfig {
  return {
    enabled: false,
    videoEnhance: createDefaultVideoEnhanceModes(),
    subtitleErase: createDefaultSubtitleEraseModes(),
  };
}

/** @deprecated */
export function createDefaultVolcanoMediaKitEnhanceConfig(): VolcanoMediaKitConfig {
  return createDefaultVolcanoMediaKitConfig();
}

export function normalizeVolcanoMediaKitConfig(
  config: VolcanoMediaKitConfig
): VolcanoMediaKitConfig {
  return {
    enabled: config.enabled,
    videoEnhance: {
      fast: config.videoEnhance.fast,
      standard: config.videoEnhance.standard,
      pro: config.videoEnhance.pro,
      llm: config.videoEnhance.llm,
    },
    subtitleErase: {
      standard: config.subtitleErase.standard,
      refined: config.subtitleErase.refined,
    },
  };
}

/** @deprecated */
export function normalizeVolcanoMediaKitEnhanceConfig(
  config: VolcanoMediaKitEnhanceConfig
): VolcanoMediaKitConfig {
  return normalizeVolcanoMediaKitConfig({
    enabled: config.enabled,
    videoEnhance: config.modes,
    subtitleErase: createDefaultSubtitleEraseModes(),
  });
}

function hasAnyMediaKitFeatureSelected(config: VolcanoMediaKitConfig): boolean {
  return (
    VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES.some((mode) => config.videoEnhance[mode]) ||
    VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES.some((mode) => config.subtitleErase[mode])
  );
}

export function isVolcanoMediaKitConfigValid(config: VolcanoMediaKitConfig): boolean {
  if (!config.enabled) {
    return true;
  }
  return hasAnyMediaKitFeatureSelected(config);
}

/** @deprecated */
export function isVolcanoMediaKitEnhanceConfigValid(
  config: VolcanoMediaKitConfig
): boolean {
  return isVolcanoMediaKitConfigValid(config);
}

export function isVolcanoMediaKitActive(config: VolcanoMediaKitConfig): boolean {
  return config.enabled && hasAnyMediaKitFeatureSelected(config);
}

export function listEnabledVolcanoMediaKitVideoEnhanceModes(
  config: VolcanoMediaKitConfig
): readonly VolcanoMediaKitVideoEnhanceMode[] {
  return VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES.filter(
    (mode) => config.videoEnhance[mode]
  );
}

/** @deprecated */
export function listEnabledVolcanoMediaKitEnhanceModes(
  config: VolcanoMediaKitConfig
): readonly VolcanoMediaKitVideoEnhanceMode[] {
  return listEnabledVolcanoMediaKitVideoEnhanceModes(config);
}

export function listEnabledVolcanoMediaKitSubtitleEraseModes(
  config: VolcanoMediaKitConfig
): readonly VolcanoMediaKitSubtitleEraseMode[] {
  return VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES.filter(
    (mode) => config.subtitleErase[mode]
  );
}

function isLegacyMediaKitEnhanceConfig(
  value: unknown
): value is VolcanoMediaKitEnhanceConfig {
  return (
    value !== null &&
    typeof value === "object" &&
    "modes" in value &&
    !("videoEnhance" in value)
  );
}

export function resolveVolcanoMediaKitFromMetadata(
  metadata: VolcanoInterfaceMetadata | null | undefined
): VolcanoMediaKitConfig {
  const config = metadata?.mediaKit ?? metadata?.mediaKitEnhance;
  if (!config) {
    return createDefaultVolcanoMediaKitConfig();
  }
  if (isLegacyMediaKitEnhanceConfig(config)) {
    return normalizeVolcanoMediaKitEnhanceConfig(config);
  }
  return normalizeVolcanoMediaKitConfig(config);
}

/** @deprecated */
export function resolveVolcanoMediaKitEnhanceFromMetadata(
  metadata: VolcanoInterfaceMetadata | null | undefined
): VolcanoMediaKitConfig {
  return resolveVolcanoMediaKitFromMetadata(metadata);
}

export function buildVolcanoMediaKitSnapshot(params: {
  readonly metadata: VolcanoInterfaceMetadata;
}): VolcanoMediaKitSnapshot {
  const config = resolveVolcanoMediaKitFromMetadata(params.metadata);
  return {
    enabled: config.enabled,
    videoEnhance: config.videoEnhance,
    subtitleErase: config.subtitleErase,
  };
}

/** @deprecated */
export function buildVolcanoMediaKitEnhanceSnapshot(params: {
  readonly metadata: VolcanoInterfaceMetadata;
}): VolcanoMediaKitSnapshot {
  return buildVolcanoMediaKitSnapshot(params);
}

export function mergeVolcanoMediaKit(
  metadata: VolcanoInterfaceMetadata,
  config: VolcanoMediaKitConfig
): VolcanoInterfaceMetadata {
  const normalized = normalizeVolcanoMediaKitConfig(config);
  const { mediaKitEnhance: _legacy, ...rest } = metadata;
  return {
    ...rest,
    mediaKit: normalized,
  };
}

/** @deprecated */
export function mergeVolcanoMediaKitEnhance(
  metadata: VolcanoInterfaceMetadata,
  config: VolcanoMediaKitConfig | VolcanoMediaKitEnhanceConfig
): VolcanoInterfaceMetadata {
  const normalized = isLegacyMediaKitEnhanceConfig(config)
    ? normalizeVolcanoMediaKitEnhanceConfig(config)
    : normalizeVolcanoMediaKitConfig(config);
  return mergeVolcanoMediaKit(metadata, normalized);
}
