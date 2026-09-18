import { buildOrgModelOptionId } from "./org-model-label";
import {
  normalizeVideoModelParameterRules,
  PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  type OrgVideoModelOption,
  type VideoModelParameterRules,
} from "./platform-ai-model";
import type { UpstreamParamProfileField } from "./upstream-param-profile";
import {
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES,
  type VolcanoMediaKitSubtitleEraseMode,
} from "./volcano-mediakit-enhance";

export const VIDEO_SUBTITLE_ERASE_META_KEY = "videoSubtitleErase" as const;

/** Refined-only: upstream `mode` param — Subtitle erases OCR-detected subtitles, Text also erases other rendered text. */
export type VolcanoMediaKitSubtitleEraseScope = "subtitle" | "text";
/** Refined-only: upstream `model_version` param. */
export type VolcanoMediaKitSubtitleEraseModelVersion = "v4" | "v5";
/** Refined-only: upstream `output_encode_mode` param. */
export type VolcanoMediaKitSubtitleEraseOutputEncodeMode = "quality" | "size";

export const VOLCANO_MEDIKIT_SUBTITLE_ERASE_SCOPES: readonly VolcanoMediaKitSubtitleEraseScope[] =
  ["subtitle", "text"] as const;
export const VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODEL_VERSIONS: readonly VolcanoMediaKitSubtitleEraseModelVersion[] =
  ["v4", "v5"] as const;
export const VOLCANO_MEDIKIT_SUBTITLE_ERASE_OUTPUT_ENCODE_MODES: readonly VolcanoMediaKitSubtitleEraseOutputEncodeMode[] =
  ["quality", "size"] as const;

export const VOLCANO_MEDIKIT_SUBTITLE_ERASE_SCOPE_LABEL_KEYS: Readonly<
  Record<VolcanoMediaKitSubtitleEraseScope, string>
> = {
  subtitle: "workflow.subtitleErase.eraseMode.subtitle",
  text: "workflow.subtitleErase.eraseMode.text",
};

export const VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODEL_VERSION_LABEL_KEYS: Readonly<
  Record<VolcanoMediaKitSubtitleEraseModelVersion, string>
> = {
  v4: "workflow.subtitleErase.modelVersion.v4",
  v5: "workflow.subtitleErase.modelVersion.v5",
};

export const VOLCANO_MEDIKIT_SUBTITLE_ERASE_OUTPUT_ENCODE_MODE_LABEL_KEYS: Readonly<
  Record<VolcanoMediaKitSubtitleEraseOutputEncodeMode, string>
> = {
  quality: "workflow.subtitleErase.outputEncodeMode.quality",
  size: "workflow.subtitleErase.outputEncodeMode.size",
};

export const VIDEO_SUBTITLE_ERASE_DEFAULT_SCOPE: VolcanoMediaKitSubtitleEraseScope =
  "subtitle";
export const VIDEO_SUBTITLE_ERASE_DEFAULT_MODEL_VERSION: VolcanoMediaKitSubtitleEraseModelVersion =
  "v5";
export const VIDEO_SUBTITLE_ERASE_DEFAULT_OUTPUT_ENCODE_MODE: VolcanoMediaKitSubtitleEraseOutputEncodeMode =
  "quality";

/** Refined-only: manual erase boxes, normalized to the video frame (0–1), matching upstream erase_ratio_location. */
export interface VideoSubtitleEraseRect {
  readonly topLeftX: number;
  readonly topLeftY: number;
  readonly bottomRightX: number;
  readonly bottomRightY: number;
}

export const VIDEO_SUBTITLE_ERASE_MAX_REGIONS = 20 as const;

/** Minimum normalized box area (0.5%) — smaller drag rectangles are discarded. */
export const VIDEO_SUBTITLE_ERASE_MIN_REGION_AREA = 0.005 as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function clampVideoSubtitleEraseRect(
  rect: VideoSubtitleEraseRect
): VideoSubtitleEraseRect {
  const left = clamp01(rect.topLeftX);
  const top = clamp01(rect.topLeftY);
  const right = clamp01(rect.bottomRightX);
  const bottom = clamp01(rect.bottomRightY);
  return {
    topLeftX: Math.min(left, right),
    topLeftY: Math.min(top, bottom),
    bottomRightX: Math.max(left, right),
    bottomRightY: Math.max(top, bottom),
  };
}

export function isVideoSubtitleEraseRect(
  value: unknown
): value is VideoSubtitleEraseRect {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const rect = value as VideoSubtitleEraseRect;
  return (
    typeof rect.topLeftX === "number" &&
    typeof rect.topLeftY === "number" &&
    typeof rect.bottomRightX === "number" &&
    typeof rect.bottomRightY === "number"
  );
}

export function normalizeVideoSubtitleEraseRects(
  value: unknown
): VideoSubtitleEraseRect[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const rects: VideoSubtitleEraseRect[] = [];
  for (const entry of value.slice(0, VIDEO_SUBTITLE_ERASE_MAX_REGIONS)) {
    if (isVideoSubtitleEraseRect(entry)) {
      rects.push(clampVideoSubtitleEraseRect(entry));
    }
  }
  return rects.length > 0 ? rects : undefined;
}
export const VIDEO_SUBTITLE_ERASE_JOB_KIND = "video_subtitle_erase" as const;
export const VIDEO_SUBTITLE_ERASE_MODEL_CANONICAL_ID =
  "volcano-mediakit-video-subtitle-erase" as const;
export const VIDEO_SUBTITLE_ERASE_MODEL_DISPLAY_NAME = "字幕擦除" as const;

export function isVideoSubtitleEraseModelCanonicalId(
  canonicalId: string
): boolean {
  return canonicalId.trim() === VIDEO_SUBTITLE_ERASE_MODEL_CANONICAL_ID;
}

function buildVideoSubtitleEraseGenerationFields(
  enabledModes: readonly VolcanoMediaKitSubtitleEraseMode[]
): readonly UpstreamParamProfileField[] {
  const modes =
    enabledModes.length > 0
      ? enabledModes
      : VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES;
  return [
    {
      name: "mode",
      apiName: "mode",
      type: "string",
      description: "Subtitle erase mode",
      default: modes[0],
      enumValues: [...modes],
    },
  ] as const;
}

export function buildVideoSubtitleEraseModelParameterRules(
  enabledModes: readonly VolcanoMediaKitSubtitleEraseMode[] = VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES
): VideoModelParameterRules {
  return normalizeVideoModelParameterRules({
    schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
    maxReferenceImages: 0,
    maxImageReferenceBytes: 0,
    maxReferenceVideos: 1,
    maxVideoReferenceBytes: 50 * 1024 * 1024,
    maxVideoReferenceSeconds: 60,
    maxReferenceAudios: 0,
    maxAudioReferenceBytes: 0,
    maxAudioReferenceSeconds: 0,
    promptMaxChars: 0,
    supportsTaskCancel: false,
    generationFields: buildVideoSubtitleEraseGenerationFields(enabledModes),
  });
}

export const VIDEO_SUBTITLE_ERASE_MODEL_PARAMETER_RULES =
  buildVideoSubtitleEraseModelParameterRules();

export function buildVideoSubtitleEraseOrgModelOption(params: {
  readonly interfaceId: string;
  readonly enabledModes: readonly VolcanoMediaKitSubtitleEraseMode[];
  readonly selectable?: boolean;
}): OrgVideoModelOption | null {
  if (params.enabledModes.length === 0) {
    return null;
  }

  const instanceId = VIDEO_SUBTITLE_ERASE_MODEL_CANONICAL_ID;
  return {
    optionId: buildOrgModelOptionId(params.interfaceId, instanceId),
    instanceId,
    canonicalId: VIDEO_SUBTITLE_ERASE_MODEL_CANONICAL_ID,
    interfaceId: params.interfaceId,
    channelKind: "aggregate",
    alias: VIDEO_SUBTITLE_ERASE_MODEL_DISPLAY_NAME,
    displayName: VIDEO_SUBTITLE_ERASE_MODEL_DISPLAY_NAME,
    modality: "video",
    providerModelId: VIDEO_SUBTITLE_ERASE_MODEL_CANONICAL_ID,
    parameterRules: buildVideoSubtitleEraseModelParameterRules(
      params.enabledModes
    ),
    supportsTaskCancel: false,
    selectable: params.selectable ?? true,
    description: "Volcano AI MediaKit subtitle erase",
    sortOrder: 10_001,
    brandIcon: null,
  };
}

export interface VideoSubtitleEraseNodeConfig {
  readonly mode: VolcanoMediaKitSubtitleEraseMode;
  readonly sourceResourceId?: string;
  readonly eraseMode?: VolcanoMediaKitSubtitleEraseScope;
  readonly modelVersion?: VolcanoMediaKitSubtitleEraseModelVersion;
  readonly outputEncodeMode?: VolcanoMediaKitSubtitleEraseOutputEncodeMode;
  readonly eraseRatioLocation?: readonly VideoSubtitleEraseRect[];
}

/** Fill refined-only options with upstream defaults so the UI/submit always has complete values. */
export function withVideoSubtitleEraseRefinedDefaults(
  config: VideoSubtitleEraseNodeConfig
): VideoSubtitleEraseNodeConfig {
  if (config.mode !== "refined") {
    return config;
  }
  return {
    ...config,
    eraseMode: config.eraseMode ?? VIDEO_SUBTITLE_ERASE_DEFAULT_SCOPE,
    modelVersion:
      config.modelVersion ?? VIDEO_SUBTITLE_ERASE_DEFAULT_MODEL_VERSION,
    outputEncodeMode:
      config.outputEncodeMode ??
      VIDEO_SUBTITLE_ERASE_DEFAULT_OUTPUT_ENCODE_MODE,
  };
}

export interface SubmitVideoSubtitleEraseRequest {
  readonly aiInterfaceId: string;
  readonly sourceVideoResourceId: string;
  readonly mode: VolcanoMediaKitSubtitleEraseMode;
  readonly eraseMode?: VolcanoMediaKitSubtitleEraseScope;
  readonly modelVersion?: VolcanoMediaKitSubtitleEraseModelVersion;
  readonly outputEncodeMode?: VolcanoMediaKitSubtitleEraseOutputEncodeMode;
  readonly eraseRatioLocation?: readonly VideoSubtitleEraseRect[];
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly clientRequestId?: string;
}

export interface SubmitVideoSubtitleEraseResponse {
  readonly taskId: string;
  readonly jobId?: string;
  readonly resourceIds?: readonly string[];
  readonly aiInterfaceId: string;
  readonly workflowNodeContent?: unknown;
}

export interface PollVideoSubtitleEraseTaskResponse {
  readonly status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  readonly videoUrl?: string;
  readonly error?: string;
}

export function parseVideoSubtitleEraseNodeConfig(
  metadata: Readonly<Record<string, string>> | undefined
): VideoSubtitleEraseNodeConfig | null {
  const raw = metadata?.[VIDEO_SUBTITLE_ERASE_META_KEY]?.trim();
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as VideoSubtitleEraseNodeConfig;
    if (typeof parsed.mode !== "string") {
      return null;
    }
    return {
      mode: parsed.mode as VolcanoMediaKitSubtitleEraseMode,
      ...(parsed.sourceResourceId
        ? { sourceResourceId: parsed.sourceResourceId }
        : {}),
      ...(parsed.eraseMode === "subtitle" || parsed.eraseMode === "text"
        ? { eraseMode: parsed.eraseMode }
        : {}),
      ...(parsed.modelVersion === "v4" || parsed.modelVersion === "v5"
        ? { modelVersion: parsed.modelVersion }
        : {}),
      ...(parsed.outputEncodeMode === "quality" ||
      parsed.outputEncodeMode === "size"
        ? { outputEncodeMode: parsed.outputEncodeMode }
        : {}),
      ...(normalizeVideoSubtitleEraseRects(parsed.eraseRatioLocation)
        ? {
            eraseRatioLocation: normalizeVideoSubtitleEraseRects(
              parsed.eraseRatioLocation
            ),
          }
        : {}),
    };
  } catch {
    return null;
  }
}

export function serializeVideoSubtitleEraseNodeConfig(
  config: VideoSubtitleEraseNodeConfig
): string {
  return JSON.stringify({
    mode: config.mode,
    ...(config.sourceResourceId
      ? { sourceResourceId: config.sourceResourceId }
      : {}),
    ...(config.eraseMode ? { eraseMode: config.eraseMode } : {}),
    ...(config.modelVersion ? { modelVersion: config.modelVersion } : {}),
    ...(config.outputEncodeMode
      ? { outputEncodeMode: config.outputEncodeMode }
      : {}),
    ...(config.eraseRatioLocation?.length
      ? { eraseRatioLocation: config.eraseRatioLocation }
      : {}),
  });
}

export function withVideoSubtitleEraseNodeConfig(
  metadata: Readonly<Record<string, string>> | undefined,
  config: VideoSubtitleEraseNodeConfig
): Record<string, string> {
  return {
    ...(metadata ?? {}),
    [VIDEO_SUBTITLE_ERASE_META_KEY]:
      serializeVideoSubtitleEraseNodeConfig(config),
  };
}
