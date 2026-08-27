import { buildOrgModelOptionId } from "./org-model-label";
import {
  normalizeVideoModelParameterRules,
  PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  type OrgVideoModelOption,
  type VideoModelParameterRules,
} from "./platform-ai-model";
import type { UpstreamParamProfileField } from "./upstream-param-profile";
import {
  VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES,
  type VolcanoMediaKitVideoEnhanceMode,
} from "./volcano-mediakit-enhance";
import {
  VOLCANO_MEDIKIT_PRICING_RESOLUTIONS,
  type VolcanoMediaKitPricingResolution,
} from "./volcano-mediakit-pricing-catalog";

export const VIDEO_ENHANCE_META_KEY = "videoEnhance" as const;
export const VIDEO_ENHANCE_PENDING_AUTO_SUBMIT_META_KEY =
  "videoEnhancePendingAutoSubmit" as const;
export const VIDEO_ENHANCE_JOB_KIND = "video_enhance" as const;
export const VIDEO_ENHANCE_MODEL_CANONICAL_ID =
  "volcano-mediakit-video-enhance" as const;
export const VIDEO_ENHANCE_MODEL_DISPLAY_NAME = "画质增强" as const;

export function isVideoEnhanceModelCanonicalId(canonicalId: string): boolean {
  return canonicalId.trim() === VIDEO_ENHANCE_MODEL_CANONICAL_ID;
}

export const VIDEO_ENHANCE_FPS_MIN = 20 as const;
export const VIDEO_ENHANCE_FPS_MAX = 120 as const;
export const VIDEO_ENHANCE_FPS_DEFAULT = 24 as const;

function buildVideoEnhanceGenerationFields(
  enabledModes: readonly VolcanoMediaKitVideoEnhanceMode[]
): readonly UpstreamParamProfileField[] {
  const modes =
    enabledModes.length > 0 ? enabledModes : VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES;
  return [
    {
      name: "mode",
      apiName: "mode",
      type: "string",
      description: "Video enhance mode",
      default: modes[0],
      enumValues: [...modes],
    },
    {
      name: "resolution",
      apiName: "resolution",
      type: "string",
      description: "Output resolution",
      default: "1080P",
      enumValues: [...VOLCANO_MEDIKIT_PRICING_RESOLUTIONS],
    },
    {
      name: "fps",
      apiName: "fps",
      type: "number",
      description: "Output frame rate",
      default: VIDEO_ENHANCE_FPS_DEFAULT,
    },
  ] as const;
}

export function buildVideoEnhanceModelParameterRules(
  enabledModes: readonly VolcanoMediaKitVideoEnhanceMode[] = VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES
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
    generationFields: buildVideoEnhanceGenerationFields(enabledModes),
  });
}

export const VIDEO_ENHANCE_MODEL_PARAMETER_RULES =
  buildVideoEnhanceModelParameterRules();

export function buildVideoEnhanceOrgModelOption(params: {
  readonly interfaceId: string;
  readonly enabledModes: readonly VolcanoMediaKitVideoEnhanceMode[];
  readonly selectable?: boolean;
}): OrgVideoModelOption | null {
  if (params.enabledModes.length === 0) {
    return null;
  }

  const instanceId = VIDEO_ENHANCE_MODEL_CANONICAL_ID;
  return {
    optionId: buildOrgModelOptionId(params.interfaceId, instanceId),
    instanceId,
    canonicalId: VIDEO_ENHANCE_MODEL_CANONICAL_ID,
    interfaceId: params.interfaceId,
    channelKind: "aggregate",
    alias: VIDEO_ENHANCE_MODEL_DISPLAY_NAME,
    displayName: VIDEO_ENHANCE_MODEL_DISPLAY_NAME,
    modality: "video",
    providerModelId: VIDEO_ENHANCE_MODEL_CANONICAL_ID,
    parameterRules: buildVideoEnhanceModelParameterRules(params.enabledModes),
    supportsTaskCancel: false,
    selectable: params.selectable ?? true,
    description: "Volcano AI MediaKit video enhance",
    sortOrder: 10_000,
    brandIcon: null,
  };
}

export interface VideoEnhanceNodeConfig {
  readonly mode: VolcanoMediaKitVideoEnhanceMode;
  readonly resolution: VolcanoMediaKitPricingResolution;
  readonly fps: number;
  readonly sourceResourceId?: string;
}

export interface SubmitVideoEnhanceRequest {
  readonly aiInterfaceId: string;
  readonly sourceVideoResourceId: string;
  readonly mode: VolcanoMediaKitVideoEnhanceMode;
  readonly resolution: VolcanoMediaKitPricingResolution;
  readonly fps: number;
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly clientRequestId?: string;
}

export interface SubmitVideoEnhanceResponse {
  readonly taskId: string;
  readonly jobId?: string;
  readonly resourceIds?: readonly string[];
  readonly aiInterfaceId: string;
  readonly workflowNodeContent?: unknown;
}

export interface PollVideoEnhanceTaskResponse {
  readonly status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  readonly videoUrl?: string;
  readonly error?: string;
}

const RESOLUTION_LONG_EDGE_PX: Readonly<
  Record<VolcanoMediaKitPricingResolution, number>
> = {
  "720P": 720,
  "1080P": 1080,
  "2K": 1440,
  "4K": 2160,
  "8K": 4320,
};

export const VIDEO_ENHANCE_DEFAULT_SOURCE_TIER = "720P" as const;

export function parseVideoEnhanceSourceTierFromLabel(
  label: string | null | undefined
): VolcanoMediaKitPricingResolution | null {
  if (!label?.trim()) {
    return null;
  }
  const normalized = label.trim().toLowerCase();
  const mapped: Record<string, VolcanoMediaKitPricingResolution> = {
    "480p": "720P",
    "720p": "720P",
    "768p": "720P",
    "1080p": "1080P",
    "2k": "2K",
    "4k": "4K",
    "8k": "8K",
  };
  return mapped[normalized] ?? null;
}

export function inferVideoEnhanceResolutionTier(
  width: number,
  height: number
): VolcanoMediaKitPricingResolution {
  const longEdge = Math.max(width, height);
  if (longEdge <= RESOLUTION_LONG_EDGE_PX["720P"]) {
    return "720P";
  }
  if (longEdge <= RESOLUTION_LONG_EDGE_PX["1080P"]) {
    return "1080P";
  }
  if (longEdge <= RESOLUTION_LONG_EDGE_PX["2K"]) {
    return "2K";
  }
  if (longEdge <= RESOLUTION_LONG_EDGE_PX["4K"]) {
    return "4K";
  }
  return "8K";
}

export function listHigherVideoEnhanceResolutions(
  source: VolcanoMediaKitPricingResolution
): readonly VolcanoMediaKitPricingResolution[] {
  const index = VOLCANO_MEDIKIT_PRICING_RESOLUTIONS.indexOf(source);
  if (index < 0) {
    return VOLCANO_MEDIKIT_PRICING_RESOLUTIONS;
  }
  return VOLCANO_MEDIKIT_PRICING_RESOLUTIONS.slice(index + 1);
}

export function toMediaKitResolutionParam(
  resolution: VolcanoMediaKitPricingResolution
): string {
  if (resolution === "2K") {
    return "2k";
  }
  if (resolution === "4K") {
    return "4k";
  }
  if (resolution === "8K") {
    return "8k";
  }
  return resolution.toLowerCase();
}

export function clampVideoEnhanceFps(fps: number): number {
  if (!Number.isFinite(fps)) {
    return VIDEO_ENHANCE_FPS_DEFAULT;
  }
  return Math.min(
    VIDEO_ENHANCE_FPS_MAX,
    Math.max(VIDEO_ENHANCE_FPS_MIN, Math.round(fps))
  );
}

export function parseVideoEnhanceNodeConfig(
  metadata: Readonly<Record<string, string>> | undefined
): VideoEnhanceNodeConfig | null {
  const raw = metadata?.[VIDEO_ENHANCE_META_KEY]?.trim();
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as VideoEnhanceNodeConfig;
    if (
      typeof parsed.mode !== "string" ||
      typeof parsed.resolution !== "string" ||
      typeof parsed.fps !== "number"
    ) {
      return null;
    }
    return {
      mode: parsed.mode,
      resolution: parsed.resolution,
      fps: clampVideoEnhanceFps(parsed.fps),
      ...(parsed.sourceResourceId
        ? { sourceResourceId: parsed.sourceResourceId }
        : {}),
    };
  } catch {
    return null;
  }
}

export function serializeVideoEnhanceNodeConfig(
  config: VideoEnhanceNodeConfig
): string {
  return JSON.stringify({
    mode: config.mode,
    resolution: config.resolution,
    fps: clampVideoEnhanceFps(config.fps),
    ...(config.sourceResourceId
      ? { sourceResourceId: config.sourceResourceId }
      : {}),
  });
}

export function withVideoEnhanceNodeConfig(
  metadata: Readonly<Record<string, string>> | undefined,
  config: VideoEnhanceNodeConfig
): Record<string, string> {
  return {
    ...(metadata ?? {}),
    [VIDEO_ENHANCE_META_KEY]: serializeVideoEnhanceNodeConfig(config),
  };
}

export function hasVideoEnhancePendingAutoSubmit(
  metadata: Readonly<Record<string, string>> | undefined
): boolean {
  return metadata?.[VIDEO_ENHANCE_PENDING_AUTO_SUBMIT_META_KEY] === "1";
}

export function withVideoEnhancePendingAutoSubmit(
  metadata: Readonly<Record<string, string>> | undefined
): Record<string, string> {
  return {
    ...(metadata ?? {}),
    [VIDEO_ENHANCE_PENDING_AUTO_SUBMIT_META_KEY]: "1",
  };
}

export function withoutVideoEnhancePendingAutoSubmit(
  metadata: Readonly<Record<string, string>> | undefined
): Record<string, string> {
  const next = { ...(metadata ?? {}) };
  delete next[VIDEO_ENHANCE_PENDING_AUTO_SUBMIT_META_KEY];
  return next;
}
