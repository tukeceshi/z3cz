import type { AiModelModality } from "./ai-model-catalog";
import type { OrgModelChannelKind } from "./org-model-label";
import type { UpstreamParamProfileField } from "./upstream-param-profile";
import {
  assignReferenceImagesToBody,
  mergeReferenceImageValues,
  type ReferenceImageInline,
} from "./reference-image-input";
import type { MediaReference, WorkflowMediaValue } from "./media-reference";
import { isMediaReference } from "./media-reference";

export const PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION = 1 as const;

export interface TextModelReferenceInputRule {
  readonly type: "string" | "image" | "video" | "any";
  readonly field: "keywords";
  readonly maxCount: number;
}

export interface TextModelParameterRules {
  readonly schemaVersion: typeof PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION;
  readonly referenceInputs: readonly TextModelReferenceInputRule[];
  readonly keywordsMaxChars: number;
  readonly promptMaxChars: number;
  readonly outputMaxTokens: number;
  readonly outputMaxTokensLimit: number;
  readonly outputMaxChars: number;
  readonly contextWindowTokens: number;
  /** Max text references connected into the AI text node. */
  readonly maxTextReferences: number;
  /** Max characters per text reference. */
  readonly maxTextReferenceChars: number;
  /** Max image references. */
  readonly maxImageReferences: number;
  /** Max bytes per image reference. */
  readonly maxImageReferenceBytes: number;
  /** Max video references. */
  readonly maxVideoReferences: number;
  /** Max bytes per video reference. */
  readonly maxVideoReferenceBytes: number;
  /** Max video duration in seconds. */
  readonly maxVideoReferenceSeconds: number;
}

export interface AiTextReferenceInput {
  readonly name: string;
  readonly content: string;
}

export const AI_TEXT_DEFAULT_QUESTION = "请根据以上内容回答。" as const;

export type GenerationSizeEffectMode =
  | "legacy"
  | "k_only"
  | "ratio_prompt"
  | "pixel_size";

export interface GenerationSizePolicy {
  readonly enabled: boolean;
  readonly effectMode: GenerationSizeEffectMode;
}

export type GenerationCountEffectMode =
  | "direct"
  | "sequential_image_generation";

/** @deprecated Stored as sequential_image_generation after normalize. */
export type LegacyGenerationCountEffectMode = "sequential";

export interface GenerationCountPolicy {
  readonly enabled: boolean;
  readonly effectMode: GenerationCountEffectMode;
}

export function normalizeGenerationCountEffectMode(
  effectMode: GenerationCountEffectMode | LegacyGenerationCountEffectMode
): GenerationCountEffectMode {
  if (effectMode === "sequential") {
    return "sequential_image_generation";
  }
  return effectMode;
}

export function normalizeGenerationCountPolicy(
  policy: GenerationCountPolicy | undefined
): GenerationCountPolicy {
  const raw = policy ?? {
    enabled: false,
    effectMode: "sequential_image_generation" as const,
  };
  return {
    enabled: raw.enabled,
    effectMode: normalizeGenerationCountEffectMode(
      raw.effectMode as GenerationCountEffectMode | LegacyGenerationCountEffectMode
    ),
  };
}

export interface ImageModelParameterRules {
  readonly schemaVersion: typeof PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION;
  readonly sizePolicy?: GenerationSizePolicy;
  readonly countPolicy?: GenerationCountPolicy;
  readonly maxReferenceImages: number;
  readonly maxImageReferenceBytes: number;
  readonly promptMaxChars: number;
  readonly generationFields: readonly UpstreamParamProfileField[];
}

export interface VideoModelParameterRules {
  readonly schemaVersion: typeof PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION;
  readonly sizePolicy?: GenerationSizePolicy;
  readonly maxReferenceImages: number;
  readonly maxImageReferenceBytes: number;
  readonly maxReferenceVideos: number;
  readonly maxVideoReferenceBytes: number;
  readonly maxVideoReferenceSeconds: number;
  readonly maxReferenceAudios: number;
  readonly maxAudioReferenceBytes: number;
  readonly maxAudioReferenceSeconds: number;
  readonly promptMaxChars: number;
  readonly generationFields: readonly UpstreamParamProfileField[];
}

export interface AudioModelParameterRules {
  readonly schemaVersion: typeof PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION;
  readonly promptMaxChars: number;
  readonly generationFields: readonly UpstreamParamProfileField[];
}

export type PlatformAiModelParameterRules =
  | TextModelParameterRules
  | ImageModelParameterRules
  | VideoModelParameterRules
  | AudioModelParameterRules;

export interface PlatformAiModel {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly platformEnabled: boolean;
  readonly parameterRules: PlatformAiModelParameterRules;
  readonly sortOrder: number;
  readonly brandIcon: string | null;
  readonly description: string;
  readonly updatedAt?: string;
}

export interface UpdatePlatformAiModelRequest {
  readonly displayName?: string;
  readonly platformEnabled?: boolean;
  readonly parameterRules?: PlatformAiModelParameterRules;
  readonly sortOrder?: number;
  readonly brandIcon?: string | null;
  readonly description?: string;
}

export interface ReorderPlatformAiModelsRequest {
  readonly orderedCanonicalIds: readonly string[];
}

export interface ListPlatformAiModelsResponse {
  readonly models: readonly PlatformAiModel[];
}

export type OrgTextModelUnavailableReason =
  | "no_org_interface"
  | "model_disabled_on_interface"
  | "model_missing_on_interface";

export interface OrgTextModelOption {
  readonly optionId: string;
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly channelKind: OrgModelChannelKind;
  readonly alias: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly providerModelId: string;
  readonly parameterRules: TextModelParameterRules;
  readonly selectable: boolean;
  readonly unavailableReason?: OrgTextModelUnavailableReason;
  readonly description: string;
  readonly sortOrder: number;
  readonly brandIcon: string | null;
}

export interface ListOrgTextModelsResponse {
  readonly models: readonly OrgTextModelOption[];
}

/** Platform-enabled models for add-interface wizards — not org interface bindings. */
export interface PlatformCatalogModelOption {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly description: string;
  readonly sortOrder: number;
  readonly brandIcon: string | null;
}

export interface ListPlatformCatalogModelsResponse {
  readonly models: readonly PlatformCatalogModelOption[];
}

export type AiModelInvocationStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

export interface AiModelInvocation {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string | null;
  readonly canonicalId: string;
  readonly displayName: string;
  readonly interfaceId: string | null;
  readonly interfaceName: string | null;
  readonly promptExcerpt: string;
  readonly content: string;
  readonly source: string;
  readonly status: AiModelInvocationStatus;
  readonly error: string | null;
  readonly generationJobId: string | null;
  /** Canvas correlation — optional; join to api_interface_request_logs via id. */
  readonly workflowId: string | null;
  readonly nodeId: string | null;
  readonly createdAt: string;
}

export interface ListAiModelInvocationsResponse {
  readonly invocations: readonly AiModelInvocation[];
  readonly total: number;
}

export interface GenerateAiTextRequest {
  readonly modelCanonicalId: string;
  readonly aiInterfaceId: string;
  readonly prompt?: string;
  readonly references?: readonly AiTextReferenceInput[];
  /** Public or ephemeral image URLs for multimodal text models (e.g. Seed). */
  readonly referenceImageUrls?: readonly string[];
  /** Browser-local image payloads when no public URL exists. */
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  /** Public or ephemeral video URLs for multimodal text models (e.g. Seed). */
  readonly referenceVideoUrls?: readonly string[];
  readonly workflowId?: string;
  readonly nodeId?: string;
}

export type OpenAiChatContentPart =
  | { readonly type: "text"; readonly text: string }
  | {
      readonly type: "image_url";
      readonly image_url: { readonly url: string };
    }
  | {
      readonly type: "video_url";
      readonly video_url: { readonly url: string };
    };

/** Build OpenAI/Ark chat `content`: string when text-only, parts when media present. */
export function buildOpenAiMultimodalUserContent(params: {
  readonly prompt: string;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly referenceVideoUrls?: readonly string[];
}): string | OpenAiChatContentPart[] {
  const imageUrls = mergeReferenceImageValues({
    referenceImageUrls: params.referenceImageUrls,
    referenceImageInline: params.referenceImageInline,
  });
  const videoUrls = (params.referenceVideoUrls ?? [])
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  if (imageUrls.length === 0 && videoUrls.length === 0) {
    return params.prompt;
  }

  const parts: OpenAiChatContentPart[] = [];
  for (const url of videoUrls) {
    parts.push({ type: "video_url", video_url: { url } });
  }
  for (const url of imageUrls) {
    parts.push({ type: "image_url", image_url: { url } });
  }
  const text = params.prompt.trim();
  if (text.length > 0) {
    parts.push({ type: "text", text });
  }
  return parts;
}

export interface GenerateAiTextResponse {
  readonly text: string;
  readonly invocationId: string;
  readonly aiInterfaceId: string;
  readonly resourceId?: string;
  readonly contentSha256?: string;
}

/** SSE payload for `/ai-text/generate-stream`. */
export type GenerateAiTextStreamEvent =
  | { readonly type: "delta"; readonly text: string }
  | {
      readonly type: "done";
      readonly text: string;
      readonly invocationId: string;
      readonly aiInterfaceId: string;
      readonly resourceId?: string;
      readonly contentSha256?: string;
    }
  | { readonly type: "error"; readonly error: string };

export interface AiTextResultHistoryItem {
  readonly id: string;
  /** Legacy inline body — omitted after resourceId migration. */
  readonly text?: string;
  readonly resourceId?: string;
  readonly contentSha256?: string;
  /** Legacy preview excerpt — omitted from workflow JSON. */
  readonly excerpt?: string;
  readonly platformModelId?: string;
  readonly aiInterfaceId?: string;
  readonly providerModelId?: string;
  readonly modelDisplayName?: string;
  readonly createdAt: string;
}

export interface AiTextResultHistory {
  readonly items: readonly AiTextResultHistoryItem[];
  readonly selectedId: string | null;
}

export type OrgImageModelUnavailableReason = OrgTextModelUnavailableReason;

export interface OrgImageModelOption {
  readonly optionId: string;
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly channelKind: OrgModelChannelKind;
  readonly alias: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly providerModelId: string;
  readonly parameterRules: ImageModelParameterRules;
  readonly selectable: boolean;
  readonly unavailableReason?: OrgImageModelUnavailableReason;
  readonly description: string;
  readonly sortOrder: number;
  readonly brandIcon: string | null;
}

export interface ListOrgImageModelsResponse {
  readonly models: readonly OrgImageModelOption[];
}

export interface GenerateAiImageRequest {
  readonly modelCanonicalId: string;
  readonly aiInterfaceId: string;
  readonly prompt?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly clientRequestId?: string;
}

export interface GenerateAiImageResponse {
  readonly images: readonly MediaReference[];
  readonly invocationId: string;
  readonly aiInterfaceId: string;
  readonly storageMode: "ephemeral" | "cloud";
  readonly jobId?: string;
  readonly phase?: "ready_to_persist" | "succeeded";
  readonly requestedCount?: number;
  readonly requestSnapshot?: ImageGenerationRequestSnapshot;
}

export type OrgVideoModelUnavailableReason = OrgTextModelUnavailableReason;

export interface OrgVideoModelOption {
  readonly optionId: string;
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly channelKind: OrgModelChannelKind;
  readonly alias: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly providerModelId: string;
  readonly parameterRules: VideoModelParameterRules;
  readonly selectable: boolean;
  readonly unavailableReason?: OrgVideoModelUnavailableReason;
  readonly description: string;
  readonly sortOrder: number;
  readonly brandIcon: string | null;
}

export interface ListOrgVideoModelsResponse {
  readonly models: readonly OrgVideoModelOption[];
}

export interface SubmitAiVideoRequest {
  readonly modelCanonicalId: string;
  readonly aiInterfaceId: string;
  readonly prompt?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly referenceVideoUrls?: readonly string[];
  readonly referenceAudioUrls?: readonly string[];
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly clientRequestId?: string;
}

export interface SubmitAiVideoMediaReferenceCounts {
  readonly imageCount: number;
  readonly videoCount: number;
  readonly audioCount: number;
}

export interface SubmitAiVideoResponse {
  readonly taskId: string;
  readonly invocationId: string;
  readonly aiInterfaceId: string;
  readonly jobId?: string;
}

export interface PollAiVideoTaskResponse {
  readonly status:
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "expired"
    | "cancelled";
  readonly videoUrl?: string;
  readonly videos?: readonly MediaReference[];
  readonly error?: string;
  readonly reason?: string;
}

export type OrgAudioModelUnavailableReason = OrgTextModelUnavailableReason;

export interface OrgAudioModelOption {
  readonly optionId: string;
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly channelKind: OrgModelChannelKind;
  readonly alias: string;
  readonly displayName: string;
  readonly modality: AiModelModality;
  readonly providerModelId: string;
  readonly parameterRules: AudioModelParameterRules;
  readonly selectable: boolean;
  readonly unavailableReason?: OrgAudioModelUnavailableReason;
  readonly description: string;
  readonly sortOrder: number;
  readonly brandIcon: string | null;
}

export interface ListOrgAudioModelsResponse {
  readonly models: readonly OrgAudioModelOption[];
}

export interface GenerateAiAudioRequest {
  readonly modelCanonicalId: string;
  readonly aiInterfaceId: string;
  readonly prompt?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly clientRequestId?: string;
}

export interface GenerateAiAudioResponse {
  readonly audios: readonly MediaReference[];
  readonly invocationId: string;
  readonly aiInterfaceId: string;
  readonly storageMode: "ephemeral" | "cloud";
  readonly jobId?: string;
  readonly phase?: "ready_to_persist" | "succeeded";
}

export interface AiImageResultHistoryItem {
  readonly id: string;
  readonly images: readonly WorkflowMediaValue[];
  readonly prompt: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly platformModelId?: string;
  readonly aiInterfaceId?: string;
  readonly providerModelId?: string;
  readonly modelDisplayName?: string;
  readonly requestSnapshot?: ImageGenerationRequestSnapshot;
  readonly createdAt: string;
}

export interface AiImageResultHistory {
  readonly items: readonly AiImageResultHistoryItem[];
  readonly selectedId: string | null;
}

export interface AiVideoResultHistoryItem {
  readonly id: string;
  readonly videos: readonly WorkflowMediaValue[];
  readonly prompt: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly platformModelId?: string;
  readonly aiInterfaceId?: string;
  readonly providerModelId?: string;
  readonly modelDisplayName?: string;
  readonly createdAt: string;
}

export interface AiVideoResultHistory {
  readonly items: readonly AiVideoResultHistoryItem[];
  readonly selectedId: string | null;
}

export const DEEPSEEK_V4_FLASH_CANONICAL_ID = "deepseek-v4-flash" as const;

export const DEFAULT_TEXT_MODEL_PARAMETER_RULES: TextModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  referenceInputs: [{ type: "any", field: "keywords", maxCount: 4 }],
  keywordsMaxChars: 32_000,
  promptMaxChars: 32_000,
  outputMaxTokens: 4096,
  outputMaxTokensLimit: 8192,
  outputMaxChars: 32_000,
  contextWindowTokens: 1_048_576,
  maxTextReferences: 4,
  maxTextReferenceChars: 32_000,
  maxImageReferences: 0,
  maxImageReferenceBytes: 10 * 1024 * 1024,
  maxVideoReferences: 0,
  maxVideoReferenceBytes: 50 * 1024 * 1024,
  maxVideoReferenceSeconds: 60,
};

/** Seedream `size` keyword presets; OpenAI adds `auto` (UI: 智能). */
export const IMAGE_SIZE_PRESETS = ["auto", "1K", "2K", "4K"] as const;

/** Frontend-only aspect ratios; injected into the prompt when not `auto`. */
export const IMAGE_RATIO_OPTIONS = [
  "auto",
  "21:9",
  "16:9",
  "3:2",
  "4:3",
  "1:1",
  "3:4",
  "2:3",
  "9:16",
] as const;

/** GPT Image quality values (OpenAI). */
export const IMAGE_QUALITY_GPT_OPTIONS = [
  "auto",
  "low",
  "medium",
  "high",
] as const;

/** Full image-generation field catalog for Admin and runtime. */
export const IMAGE_GENERATION_FIELD_CATALOG: readonly UpstreamParamProfileField[] =
  [
    {
      name: "size",
      apiName: "size",
      type: "string",
      description: "分辨率",
      default: "auto",
      enumValues: IMAGE_SIZE_PRESETS,
      implementationMode: "direct",
    },
    {
      name: "ratio",
      apiName: "",
      type: "string",
      description: "选择比例",
      default: "auto",
      enumValues: IMAGE_RATIO_OPTIONS,
      clientOnly: true,
      implementationMode: "ratio_prompt",
    },
    {
      name: "generate_count",
      apiName: "max_images",
      type: "number",
      description: "生成数量",
      default: 1,
      enumValues: ["1", "2", "3", "4"],
      clientOnly: true,
      implementationMode: "sequential_count",
    },
    {
      name: "optimize_prompt_mode",
      apiName: "optimize_prompt_options.mode",
      type: "string",
      description: "模式",
      default: "standard",
      enumValues: ["standard", "fast"],
    },
    {
      name: "background",
      apiName: "background",
      type: "string",
      description: "背景",
      default: "auto",
      enumValues: ["auto", "transparent", "opaque"],
    },
    {
      name: "quality",
      apiName: "quality",
      type: "string",
      description: "图片质量",
      default: "auto",
      enumValues: [...IMAGE_QUALITY_GPT_OPTIONS],
    },
    {
      name: "watermark",
      apiName: "watermark",
      type: "boolean",
      description: "水印",
      default: false,
    },
    {
      name: "output_format",
      apiName: "output_format",
      type: "string",
      description: "输出格式",
      default: "png",
      enumValues: ["png", "jpeg", "webp"],
    },
    {
      name: "web_search",
      apiName: "web_search",
      type: "boolean",
      description: "联网搜索",
      default: false,
    },
    {
      name: "output_compression",
      apiName: "output_compression",
      type: "number",
      description: "输出压缩（0–100）",
      default: 100,
    },
    {
      name: "moderation",
      apiName: "moderation",
      type: "string",
      description: "内容审核强度",
      default: "auto",
      enumValues: ["auto", "low"],
    },
  ] as const;

const DEFAULT_IMAGE_FIELD_NAMES = new Set([
  "size",
  "ratio",
  "watermark",
]);

/** Defaults for new image models; extended params are enabled in Admin. */
export const DEFAULT_IMAGE_GENERATION_FIELDS: readonly UpstreamParamProfileField[] =
  IMAGE_GENERATION_FIELD_CATALOG.filter((field) =>
    DEFAULT_IMAGE_FIELD_NAMES.has(field.name)
  );

export const DEFAULT_IMAGE_MODEL_PARAMETER_RULES: ImageModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  maxReferenceImages: 4,
  maxImageReferenceBytes: 10 * 1024 * 1024,
  promptMaxChars: 600,
  generationFields: DEFAULT_IMAGE_GENERATION_FIELDS,
};

export const VIDEO_DURATION_MIN = 4;
export const VIDEO_DURATION_MAX = 15;

export const VIDEO_REFERENCE_MODE_OPTIONS = [
  "reference_image",
  "first_last_frame",
] as const;

export type VideoReferenceMode = (typeof VIDEO_REFERENCE_MODE_OPTIONS)[number];

export function buildDurationOptions(
  minSeconds: number,
  maxSeconds: number
): readonly string[] {
  const min = Math.max(1, Math.floor(minSeconds));
  const max = Math.max(min, Math.floor(maxSeconds));
  return Array.from({ length: max - min + 1 }, (_, index) => String(min + index));
}

export function resolveDurationOptions(
  field: UpstreamParamProfileField | undefined
): readonly string[] {
  if (!field) {
    return buildDurationOptions(VIDEO_DURATION_MIN, VIDEO_DURATION_MAX);
  }
  const fromEnum = (field.enumValues ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 1);
  if (fromEnum.length > 0) {
    return buildDurationOptions(Math.min(...fromEnum), Math.max(...fromEnum));
  }
  const fallbackDefault =
    typeof field.default === "number"
      ? field.default
      : Number(field.default) || VIDEO_DURATION_MIN;
  return buildDurationOptions(
    VIDEO_DURATION_MIN,
    Math.max(VIDEO_DURATION_MAX, fallbackDefault)
  );
}

const IMAGE_GENERATE_COUNT_MAX = 15;

export function buildGenerateCountOptions(maxCount: number): readonly string[] {
  const max = Math.min(
    IMAGE_GENERATE_COUNT_MAX,
    Math.max(1, Math.floor(maxCount))
  );
  return Array.from({ length: max }, (_, index) => String(index + 1));
}

export const VIDEO_RATIO_OPTIONS = [
  "adaptive",
  "16:9",
  "9:16",
  "4:3",
  "1:1",
  "3:4",
  "21:9",
] as const;

export const VIDEO_RESOLUTION_OPTIONS = [
  "480p",
  "720p",
  "1080p",
  "4k",
] as const;

/** Full video-generation field catalog for Admin and runtime. */
export const VIDEO_GENERATION_FIELD_CATALOG: readonly UpstreamParamProfileField[] =
  [
    {
      name: "ratio",
      apiName: "ratio",
      type: "string",
      description: "画面比例",
      default: "16:9",
      enumValues: [...VIDEO_RATIO_OPTIONS],
    },
    {
      name: "duration",
      apiName: "duration",
      type: "number",
      description: "视频时长",
      default: 5,
      enumValues: buildDurationOptions(VIDEO_DURATION_MIN, VIDEO_DURATION_MAX),
    },
    {
      name: "resolution",
      apiName: "resolution",
      type: "string",
      description: "分辨率",
      default: "720p",
      enumValues: [...VIDEO_RESOLUTION_OPTIONS],
    },
    {
      name: "generate_audio",
      apiName: "generate_audio",
      type: "boolean",
      description: "生成音频",
      default: true,
    },
    {
      name: "watermark",
      apiName: "watermark",
      type: "boolean",
      description: "水印",
      default: false,
    },
    {
      name: "reference_mode",
      apiName: "",
      type: "string",
      description: "参考模式",
      default: "reference_image",
      enumValues: [...VIDEO_REFERENCE_MODE_OPTIONS],
      clientOnly: true,
    },
    {
      name: "web_search",
      apiName: "web_search",
      type: "boolean",
      description: "联网搜索",
      default: false,
    },
    {
      name: "virtual_avatar_library",
      apiName: "",
      type: "boolean",
      description: "虚拟形象库",
      default: false,
      clientOnly: true,
    },
    {
      name: "return_last_frame",
      apiName: "return_last_frame",
      type: "boolean",
      description: "返回尾帧",
      default: false,
    },
    {
      name: "seed",
      apiName: "seed",
      type: "number",
      description: "随机种子（-1 为随机）",
      default: -1,
      hidden: true,
    },
    {
      name: "execution_expires_after",
      apiName: "execution_expires_after",
      type: "number",
      description: "任务超时（秒）",
      default: 172_800,
      hidden: true,
    },
  ] as const;

const DEFAULT_VIDEO_FIELD_NAMES = new Set([
  "ratio",
  "duration",
  "resolution",
  "generate_audio",
  "watermark",
  "reference_mode",
  "web_search",
  "virtual_avatar_library",
  "return_last_frame",
  "seed",
]);

/** Seedance-aligned defaults for new video models. */
export const DEFAULT_VIDEO_GENERATION_FIELDS: readonly UpstreamParamProfileField[] =
  VIDEO_GENERATION_FIELD_CATALOG.filter((field) =>
    DEFAULT_VIDEO_FIELD_NAMES.has(field.name)
  );

export const DEFAULT_VIDEO_MODEL_PARAMETER_RULES: VideoModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  maxReferenceImages: 2,
  maxImageReferenceBytes: 10 * 1024 * 1024,
  maxReferenceVideos: 1,
  maxVideoReferenceBytes: 50 * 1024 * 1024,
  maxVideoReferenceSeconds: 60,
  maxReferenceAudios: 3,
  maxAudioReferenceBytes: 15 * 1024 * 1024,
  maxAudioReferenceSeconds: 15,
  promptMaxChars: 1000,
  generationFields: DEFAULT_VIDEO_GENERATION_FIELDS,
};

export const DEFAULT_AUDIO_GENERATION_FIELDS: readonly UpstreamParamProfileField[] =
  [
    {
      name: "speed",
      apiName: "voice_setting.speed",
      type: "number",
      description: "语速",
      default: 1,
    },
    {
      name: "vol",
      apiName: "voice_setting.vol",
      type: "number",
      description: "音量",
      default: 1,
    },
    {
      name: "pitch",
      apiName: "voice_setting.pitch",
      type: "number",
      description: "音调",
      default: 0,
    },
    {
      name: "emotion",
      apiName: "voice_setting.emotion",
      type: "string",
      description: "情感风格",
      default: "neutral",
      enumValues: [
        "happy",
        "sad",
        "angry",
        "fearful",
        "disgusted",
        "surprised",
        "neutral",
      ],
    },
    {
      name: "voice_id",
      apiName: "voice_setting.voice_id",
      type: "string",
      description: "默认音色",
      default: "male-qn-qingse",
      hidden: true,
    },
  ] as const;

export const DEFAULT_AUDIO_MODEL_PARAMETER_RULES: AudioModelParameterRules = {
  schemaVersion: PLATFORM_AI_MODEL_RULES_SCHEMA_VERSION,
  promptMaxChars: 5000,
  generationFields: DEFAULT_AUDIO_GENERATION_FIELDS,
};

export function isTextModelParameterRules(
  rules: PlatformAiModelParameterRules
): rules is TextModelParameterRules {
  return (
    "referenceInputs" in rules ||
    ("promptMaxChars" in rules &&
      !("generationFields" in rules) &&
      !("maxReferenceImages" in rules) &&
      !("maxReferenceVideos" in rules))
  );
}

export function isImageModelParameterRules(
  rules: PlatformAiModelParameterRules
): rules is ImageModelParameterRules {
  return (
    "maxReferenceImages" in rules &&
    !("referenceInputs" in rules) &&
    !("maxReferenceVideos" in rules)
  );
}

export function isVideoModelParameterRules(
  rules: PlatformAiModelParameterRules
): rules is VideoModelParameterRules {
  return "maxReferenceVideos" in rules && !("referenceInputs" in rules);
}

export function isAudioModelParameterRules(
  rules: PlatformAiModelParameterRules
): rules is AudioModelParameterRules {
  return (
    "generationFields" in rules &&
    !("referenceInputs" in rules) &&
    !("maxReferenceImages" in rules) &&
    !("maxReferenceVideos" in rules)
  );
}

export function normalizeVideoModelParameterRules(
  rules: VideoModelParameterRules
): VideoModelParameterRules {
  const generationFields = (
    rules.generationFields?.length > 0
      ? rules.generationFields
      : DEFAULT_VIDEO_MODEL_PARAMETER_RULES.generationFields
  ).filter((field) => field.name !== "generate_count");

  return {
    ...DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
    ...rules,
    sizePolicy: rules.sizePolicy ?? { enabled: false, effectMode: "legacy" },
    maxReferenceImages:
      rules.maxReferenceImages ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceImages,
    maxImageReferenceBytes:
      rules.maxImageReferenceBytes ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxImageReferenceBytes,
    maxReferenceVideos:
      rules.maxReferenceVideos ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceVideos,
    maxVideoReferenceBytes:
      rules.maxVideoReferenceBytes ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceBytes,
    maxVideoReferenceSeconds:
      rules.maxVideoReferenceSeconds ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceSeconds,
    maxReferenceAudios:
      rules.maxReferenceAudios ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceAudios,
    maxAudioReferenceBytes:
      rules.maxAudioReferenceBytes ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxAudioReferenceBytes,
    maxAudioReferenceSeconds:
      rules.maxAudioReferenceSeconds ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxAudioReferenceSeconds,
    promptMaxChars:
      rules.promptMaxChars ??
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES.promptMaxChars,
    generationFields,
  };
}

export function countSubmitAiVideoMediaReferences(
  body: Pick<
    SubmitAiVideoRequest,
    | "referenceImageUrls"
    | "referenceImageInline"
    | "referenceVideoUrls"
    | "referenceAudioUrls"
  >
): SubmitAiVideoMediaReferenceCounts {
  return {
    imageCount:
      (body.referenceImageUrls?.length ?? 0) +
      (body.referenceImageInline?.length ?? 0),
    videoCount: body.referenceVideoUrls?.length ?? 0,
    audioCount: body.referenceAudioUrls?.length ?? 0,
  };
}

export function referencesFitVideoModelReferenceLimits(
  counts: SubmitAiVideoMediaReferenceCounts,
  rules: VideoModelParameterRules
): boolean {
  const normalized = normalizeVideoModelParameterRules(rules);
  return (
    counts.imageCount <= normalized.maxReferenceImages &&
    counts.videoCount <= normalized.maxReferenceVideos &&
    counts.audioCount <= normalized.maxReferenceAudios
  );
}

export function validateSubmitAiVideoReferences(params: {
  readonly prompt: string;
  readonly counts: SubmitAiVideoMediaReferenceCounts;
  readonly rules: VideoModelParameterRules;
}): { readonly ok: true } | { readonly ok: false; readonly error: string } {
  const trimmedPrompt = params.prompt.trim();
  const totalMedia =
    params.counts.imageCount + params.counts.videoCount + params.counts.audioCount;

  if (!trimmedPrompt && totalMedia === 0) {
    return { ok: false, error: "Prompt is required" };
  }

  if (!referencesFitVideoModelReferenceLimits(params.counts, params.rules)) {
    return { ok: false, error: "Reference count exceeds model limits" };
  }

  if (
    params.counts.audioCount > 0 &&
    params.counts.imageCount === 0 &&
    params.counts.videoCount === 0
  ) {
    return {
      ok: false,
      error: "Audio references require at least one image or video reference",
    };
  }

  return { ok: true };
}

export function normalizeImageModelParameterRules(
  rules: ImageModelParameterRules
): ImageModelParameterRules {
  const generationFields =
    rules.generationFields?.length > 0
      ? rules.generationFields
      : DEFAULT_IMAGE_MODEL_PARAMETER_RULES.generationFields;

  return {
    ...DEFAULT_IMAGE_MODEL_PARAMETER_RULES,
    ...rules,
    sizePolicy: rules.sizePolicy ?? { enabled: false, effectMode: "legacy" },
    countPolicy: normalizeGenerationCountPolicy(rules.countPolicy),
    maxReferenceImages:
      rules.maxReferenceImages ??
      DEFAULT_IMAGE_MODEL_PARAMETER_RULES.maxReferenceImages,
    maxImageReferenceBytes:
      rules.maxImageReferenceBytes ??
      DEFAULT_IMAGE_MODEL_PARAMETER_RULES.maxImageReferenceBytes,
    promptMaxChars:
      rules.promptMaxChars ??
      DEFAULT_IMAGE_MODEL_PARAMETER_RULES.promptMaxChars,
    generationFields,
  };
}

export function normalizeAudioModelParameterRules(
  rules: AudioModelParameterRules
): AudioModelParameterRules {
  const generationFields =
    rules.generationFields?.length > 0
      ? rules.generationFields
      : DEFAULT_AUDIO_MODEL_PARAMETER_RULES.generationFields;

  return {
    ...DEFAULT_AUDIO_MODEL_PARAMETER_RULES,
    ...rules,
    promptMaxChars:
      rules.promptMaxChars ??
      DEFAULT_AUDIO_MODEL_PARAMETER_RULES.promptMaxChars,
    generationFields,
  };
}

/** Options shown in the node UI: 1..max from field enumValues / default. */
export function resolveGenerateCountOptions(
  field: UpstreamParamProfileField | undefined
): readonly string[] {
  if (!field) {
    return buildGenerateCountOptions(1);
  }
  const fromEnum = (field.enumValues ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 1);
  const max =
    fromEnum.length > 0
      ? Math.max(...fromEnum)
      : typeof field.default === "number"
        ? field.default
        : Number(field.default) || 1;
  return buildGenerateCountOptions(max);
}

/** Resolve UI generate count (1–15); drives sequential group generation. */
export function resolveImageGenerateCount(
  params: Readonly<Record<string, unknown>> | undefined,
  fields: readonly UpstreamParamProfileField[]
): number {
  const field = fields.find((item) => item.name === "generate_count");
  const raw = params?.generate_count ?? field?.default ?? 1;
  const count = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(count) || count < 1) {
    return 1;
  }
  const countOptions = resolveGenerateCountOptions(field);
  const maxOption = Number(
    countOptions.length > 0 ? countOptions[countOptions.length - 1] : 1
  );
  return Math.min(Math.floor(count), maxOption, IMAGE_GENERATE_COUNT_MAX);
}

/** Key inside sequential_image_generation_options for multi-image count (Seedream default: max_images). */
export function resolveImageGenerateCountApiName(
  fields: readonly UpstreamParamProfileField[]
): string {
  const field = fields.find((item) => item.name === "generate_count");
  const apiName = field?.apiName?.trim();
  return apiName && apiName.length > 0 ? apiName : "max_images";
}

/**
 * Append aspect-ratio hint to the prompt when the user picked a fixed ratio.
 * Seedream keyword `size` (2K/3K) has no separate ratio API field.
 */
export function applyAiImageRatioToPrompt(
  prompt: string,
  ratio: unknown
): string {
  const value = typeof ratio === "string" ? ratio.trim() : "";
  if (!value || value === "auto" || value === "adaptive") {
    return prompt;
  }

  const hintZh = `画面比例 ${value}`;
  const hintEn = `aspect ratio ${value}`;
  if (prompt.includes(hintZh) || prompt.includes(hintEn)) {
    return prompt;
  }

  const trimmed = prompt.trim();
  return trimmed.length > 0 ? `${trimmed}, ${hintZh}` : hintZh;
}

function isStoredGenerationValuePresent(stored: unknown): boolean {
  return stored !== undefined && stored !== null && stored !== "";
}

function resolveImageGenerationFieldValue(
  field: UpstreamParamProfileField,
  stored: unknown
): unknown | undefined {
  if (field.hidden) {
    return undefined;
  }

  if (field.type === "boolean") {
    if (isStoredGenerationValuePresent(stored) && typeof stored === "boolean") {
      return stored;
    }
    return field.default;
  }

  if (field.type === "number") {
    if (isStoredGenerationValuePresent(stored)) {
      const numeric = typeof stored === "number" ? stored : Number(stored);
      if (Number.isFinite(numeric)) {
        const options = resolveGenerateCountOptions(field);
        if (options.length > 0) {
          const asString = String(Math.floor(numeric));
          if (options.includes(asString)) {
            return numeric;
          }
        } else {
          return numeric;
        }
      }
    }
    return field.default;
  }

  if (field.enumValues?.length) {
    const raw = isStoredGenerationValuePresent(stored) ? String(stored) : "";
    if (raw && field.enumValues.includes(raw)) {
      return raw;
    }
    if (field.default !== undefined && field.default !== null && field.default !== "") {
      return field.default;
    }
    return field.enumValues[0];
  }

  if (isStoredGenerationValuePresent(stored)) {
    return stored;
  }

  return field.default;
}

/** Keep only params for the current model fields; invalid values fall back to defaults. */
export function sanitizeImageGenerationParams(
  fields: readonly UpstreamParamProfileField[],
  params?: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = resolveImageGenerationFieldValue(field, params?.[field.name]);
    if (value !== undefined) {
      out[field.name] = value;
    }
  }
  return out;
}

/** Fill field defaults then overlay user/UI values. */
export function mergeImageGenerationParams(
  fields: readonly UpstreamParamProfileField[],
  params?: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  return sanitizeImageGenerationParams(fields, params);
}

/** Audit snapshot of outbound /images/generations fields (no secrets). */
export interface ImageGenerationRequestSnapshot {
  readonly size?: string;
  readonly watermark?: boolean;
  readonly sequentialImageGeneration?: string;
  readonly maxImages?: number;
  readonly promptExcerpt?: string;
}

function excerptPromptForSnapshot(prompt: string): string | undefined {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
}

/** Build audit snapshot from outbound /images/generations body (no secrets). */
export function buildImageGenerationRequestSnapshot(params: {
  readonly body: Readonly<Record<string, unknown>>;
  readonly prompt?: string;
}): ImageGenerationRequestSnapshot {
  const snapshot: {
    size?: string;
    watermark?: boolean;
    sequentialImageGeneration?: string;
    maxImages?: number;
    promptExcerpt?: string;
  } = {};

  const size = params.body.size;
  if (typeof size === "string" && size.length > 0) {
    snapshot.size = size;
  }

  const watermark = params.body.watermark;
  if (typeof watermark === "boolean") {
    snapshot.watermark = watermark;
  }

  const sequential = params.body.sequential_image_generation;
  if (typeof sequential === "string" && sequential.length > 0) {
    snapshot.sequentialImageGeneration = sequential;
  }

  const options = params.body.sequential_image_generation_options;
  if (options && typeof options === "object") {
    const maxImages = Object.values(options).find(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value)
    );
    if (maxImages !== undefined) {
      snapshot.maxImages = maxImages;
    }
  }

  const promptExcerpt = excerptPromptForSnapshot(params.prompt ?? "");
  if (promptExcerpt) {
    snapshot.promptExcerpt = promptExcerpt;
  }

  return snapshot;
}

/** Build Volcano /images/generations body from admin field definitions. */
export function buildVolcanoImageGenerationBody(params: {
  readonly providerModelId: string;
  readonly prompt: string;
  readonly generationFields: readonly UpstreamParamProfileField[];
  readonly params?: Readonly<Record<string, unknown>>;
  readonly countPolicy?: GenerationCountPolicy;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
}): Record<string, unknown> {
  const mergedParams = mergeImageGenerationParams(
    params.generationFields,
    params.params
  );
  const trimmedPrompt = params.prompt.trim();
  const body: Record<string, unknown> = {
    model: params.providerModelId,
    stream: false,
    response_format: "url",
  };

  if (trimmedPrompt.length > 0) {
    body.prompt = trimmedPrompt;
  }

  for (const field of params.generationFields) {
    if (field.clientOnly || !field.apiName) {
      continue;
    }

    const raw = mergedParams[field.name];
    const value =
      raw === undefined || raw === null || raw === ""
        ? field.default
        : raw;

    if (field.type === "boolean") {
      if (value === undefined || value === null) {
        continue;
      }
      body[field.apiName] = value === true;
      continue;
    }

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (field.apiName === "web_search") {
      if (value === true) {
        body.tools = [{ type: "web_search" }];
      }
      continue;
    }

    if (field.apiName.includes(".")) {
      const [root, leaf] = field.apiName.split(".", 2);
      const existing =
        body[root] && typeof body[root] === "object"
          ? (body[root] as Record<string, unknown>)
          : {};
      body[root] = { ...existing, [leaf!]: value };
      continue;
    }

    body[field.apiName] = value;
  }

  const generateCount = resolveImageGenerateCount(
    mergedParams,
    params.generationFields
  );
  const countApiName = resolveImageGenerateCountApiName(
    params.generationFields
  );
  const countPolicy = normalizeGenerationCountPolicy(
    params.countPolicy ?? {
      enabled: true,
      effectMode: "sequential_image_generation",
    }
  );

  if (countPolicy.enabled) {
    if (countPolicy.effectMode === "sequential_image_generation") {
      if (generateCount > 1) {
        body.sequential_image_generation = "auto";
        body.sequential_image_generation_options = {
          [countApiName]: generateCount,
        };
      } else {
        body.sequential_image_generation = "disabled";
        delete body.sequential_image_generation_options;
      }
    } else {
      body.sequential_image_generation = "disabled";
      delete body.sequential_image_generation_options;
      if (generateCount > 1) {
        body[countApiName] = generateCount;
      }
    }
  } else {
    body.sequential_image_generation = "disabled";
    delete body.sequential_image_generation_options;
  }

  const referenceValues = mergeReferenceImageValues({
    referenceImageUrls: params.referenceImageUrls,
    referenceImageInline: params.referenceImageInline,
  });
  assignReferenceImagesToBody(body, referenceValues);

  return body;
}

export function resolveVideoReferenceMode(
  fields: readonly UpstreamParamProfileField[],
  params?: Readonly<Record<string, unknown>>
): VideoReferenceMode {
  const field = fields.find((entry) => entry.name === "reference_mode");
  if (!field || field.hidden) {
    return "reference_image";
  }
  const raw = params?.reference_mode ?? field.default;
  return raw === "first_last_frame" ? "first_last_frame" : "reference_image";
}

export function appendVideoReferenceImagesToContent(
  content: Record<string, unknown>[],
  imageUrls: readonly string[],
  mode: VideoReferenceMode,
  hasNonImageReferences: boolean
): void {
  if (imageUrls.length === 0) {
    return;
  }

  const useReferenceImage =
    mode === "reference_image" ||
    hasNonImageReferences ||
    imageUrls.length !== 2;

  if (useReferenceImage) {
    for (const url of imageUrls) {
      content.push({
        type: "image_url",
        image_url: { url },
        role: "reference_image",
      });
    }
    return;
  }

  content.push({
    type: "image_url",
    image_url: { url: imageUrls[0]! },
    role: "first_frame",
  });
  content.push({
    type: "image_url",
    image_url: { url: imageUrls[1]! },
    role: "last_frame",
  });
}

/** Build Volcano /contents/generations/tasks body from admin field definitions. */
export function buildVolcanoVideoGenerationBody(params: {
  readonly providerModelId: string;
  readonly prompt: string;
  readonly generationFields: readonly UpstreamParamProfileField[];
  readonly params?: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly referenceVideoUrls?: readonly string[];
  readonly referenceAudioUrls?: readonly string[];
}): Record<string, unknown> {
  const mergedParams = mergeImageGenerationParams(
    params.generationFields,
    params.params
  );
  const trimmedPrompt = params.prompt.trim();
  const content: Record<string, unknown>[] = [];

  if (trimmedPrompt.length > 0) {
    content.push({ type: "text", text: trimmedPrompt });
  }

  const referenceMode = resolveVideoReferenceMode(
    params.generationFields,
    mergedParams
  );
  const hasNonImageReferences =
    (params.referenceVideoUrls?.length ?? 0) > 0 ||
    (params.referenceAudioUrls?.length ?? 0) > 0;
  const referenceValues = mergeReferenceImageValues({
    referenceImageUrls: params.referenceImageUrls,
    referenceImageInline: params.referenceImageInline,
  });
  appendVideoReferenceImagesToContent(
    content,
    referenceValues,
    referenceMode,
    hasNonImageReferences
  );

  for (const url of params.referenceVideoUrls ?? []) {
    content.push({
      type: "video_url",
      video_url: { url },
      role: "reference_video",
    });
  }
  for (const url of params.referenceAudioUrls ?? []) {
    content.push({
      type: "audio_url",
      audio_url: { url },
      role: "reference_audio",
    });
  }

  const body: Record<string, unknown> = {
    model: params.providerModelId,
    content,
  };

  for (const field of params.generationFields) {
    if (field.clientOnly || !field.apiName) {
      continue;
    }

    const raw = mergedParams[field.name];
    const value =
      raw === undefined || raw === null || raw === ""
        ? field.default
        : raw;

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (field.type === "boolean") {
      body[field.apiName] = value === true;
      continue;
    }

    if (field.apiName === "web_search") {
      if (value === true) {
        body.tools = [{ type: "web_search" }];
      }
      continue;
    }

    if (field.apiName.includes(".")) {
      const [root, leaf] = field.apiName.split(".", 2);
      const existing =
        body[root] && typeof body[root] === "object"
          ? (body[root] as Record<string, unknown>)
          : {};
      body[root] = { ...existing, [leaf!]: value };
      continue;
    }

    body[field.apiName] = value;
  }

  return body;
}

/** Normalize older DB rows that lack the newer reference-limit fields. */
export function normalizeTextModelParameterRules(
  rules: TextModelParameterRules
): TextModelParameterRules {
  return {
    ...DEFAULT_TEXT_MODEL_PARAMETER_RULES,
    ...rules,
    referenceInputs:
      rules.referenceInputs?.length > 0
        ? rules.referenceInputs.map((entry) => ({
            type: entry.type ?? "any",
            field: "keywords" as const,
            maxCount:
              typeof entry.maxCount === "number"
                ? entry.maxCount
                : DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxTextReferences,
          }))
        : DEFAULT_TEXT_MODEL_PARAMETER_RULES.referenceInputs,
    maxTextReferences:
      rules.maxTextReferences ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxTextReferences,
    maxTextReferenceChars:
      rules.maxTextReferenceChars ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxTextReferenceChars,
    maxImageReferences:
      rules.maxImageReferences ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxImageReferences,
    maxImageReferenceBytes:
      rules.maxImageReferenceBytes ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxImageReferenceBytes,
    maxVideoReferences:
      rules.maxVideoReferences ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxVideoReferences,
    maxVideoReferenceBytes:
      rules.maxVideoReferenceBytes ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxVideoReferenceBytes,
    maxVideoReferenceSeconds:
      rules.maxVideoReferenceSeconds ??
      DEFAULT_TEXT_MODEL_PARAMETER_RULES.maxVideoReferenceSeconds,
  };
}

export function formatAiTextReferenceBlock(
  name: string,
  content: string
): string {
  return `[file name]: ${name}\n[file content begin]\n${content}\n[file content end]`;
}

/** Build the user message for text models (DeepSeek file-block convention). */
export function buildAiTextUserPrompt(params: {
  readonly references?: readonly AiTextReferenceInput[];
  readonly question?: string;
  readonly defaultQuestion?: string;
  /** When true and there is no text, fall back to defaultQuestion for multimodal. */
  readonly hasMediaReferences?: boolean;
}): string {
  const references = (params.references ?? [])
    .map((entry) => ({
      name: entry.name.trim() || "reference",
      content: entry.content.trim(),
    }))
    .filter((entry) => entry.content.length > 0);

  const question =
    typeof params.question === "string" ? params.question.trim() : "";

  if (references.length === 0) {
    if (question) {
      return question;
    }
    if (params.hasMediaReferences) {
      return params.defaultQuestion || AI_TEXT_DEFAULT_QUESTION;
    }
    return "";
  }

  const blocks = references.map((entry) =>
    formatAiTextReferenceBlock(entry.name, entry.content)
  );
  const finalQuestion =
    question || params.defaultQuestion || AI_TEXT_DEFAULT_QUESTION;

  return `${blocks.join("\n")}\n${finalQuestion}`;
}

export function normalizeAiTextReferences(
  keywords: unknown
): readonly AiTextReferenceInput[] {
  if (typeof keywords === "string" && keywords.trim().length > 0) {
    return [{ name: "reference", content: keywords.trim() }];
  }
  if (Array.isArray(keywords)) {
    return keywords
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((content, index) => ({
        name: `reference-${index + 1}`,
        content,
      }));
  }
  return [];
}

function flattenAiTextKeywordValues(keywords: unknown): unknown[] {
  if (keywords == null) {
    return [];
  }
  if (Array.isArray(keywords)) {
    return keywords.flatMap((entry) => flattenAiTextKeywordValues(entry));
  }
  return [keywords];
}

function isVideoMimeType(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("video/");
}

/** Collect image/video MediaReferences from AI text keywords input. */
export function collectAiTextMediaReferences(keywords: unknown): {
  readonly images: readonly MediaReference[];
  readonly videos: readonly MediaReference[];
} {
  const images: MediaReference[] = [];
  const videos: MediaReference[] = [];

  for (const entry of flattenAiTextKeywordValues(keywords)) {
    if (!isMediaReference(entry)) {
      continue;
    }
    if (isVideoMimeType(entry.mimeType)) {
      videos.push(entry);
    } else {
      images.push(entry);
    }
  }

  return { images, videos };
}

export type AiTextPromptAssemblyResult =
  | { readonly ok: true; readonly prompt: string }
  | { readonly ok: false; readonly error: string };

export function validateAiTextPromptAssembly(params: {
  readonly references?: readonly AiTextReferenceInput[];
  readonly question?: string;
  readonly parameterRules: Pick<
    TextModelParameterRules,
    "keywordsMaxChars" | "promptMaxChars"
  >;
  readonly mediaReferenceCount?: number;
}): AiTextPromptAssemblyResult {
  const references = params.references ?? [];
  const question =
    typeof params.question === "string" ? params.question.trim() : "";
  const hasMediaReferences = (params.mediaReferenceCount ?? 0) > 0;

  const referencesContentLength = references.reduce(
    (sum, entry) => sum + entry.content.trim().length,
    0
  );

  if (referencesContentLength > params.parameterRules.keywordsMaxChars) {
    return {
      ok: false,
      error: `References exceed maximum length of ${params.parameterRules.keywordsMaxChars} characters`,
    };
  }

  if (question.length > params.parameterRules.promptMaxChars) {
    return {
      ok: false,
      error: `Question exceeds maximum length of ${params.parameterRules.promptMaxChars} characters`,
    };
  }

  const prompt = buildAiTextUserPrompt({
    references,
    question,
    hasMediaReferences,
  });
  if (!prompt) {
    return { ok: false, error: "Prompt or references are required" };
  }

  if (prompt.length > params.parameterRules.promptMaxChars) {
    return {
      ok: false,
      error: `Input exceeds maximum length of ${params.parameterRules.promptMaxChars} characters`,
    };
  }

  return { ok: true, prompt };
}

export function countGenerateAiTextMediaReferences(
  body: Pick<
    GenerateAiTextRequest,
    "referenceImageUrls" | "referenceImageInline" | "referenceVideoUrls"
  >
): { readonly imageCount: number; readonly videoCount: number } {
  return {
    imageCount:
      (body.referenceImageUrls?.length ?? 0) +
      (body.referenceImageInline?.length ?? 0),
    videoCount: body.referenceVideoUrls?.length ?? 0,
  };
}
