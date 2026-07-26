import type { AiModelModality } from "./ai-model-catalog";
import {
  CLAUDE_BRAND_ONLY_CANONICAL_IDS,
  GEMINI_BRAND_ONLY_CANONICAL_IDS,
  GROK_BRAND_ONLY_CANONICAL_IDS,
  GROK_IMAGINE_IMAGE_BRAND_ONLY_CANONICAL_IDS,
  GROK_IMAGINE_VIDEO_BRAND_ONLY_CANONICAL_IDS,
  MOONSHOT_BRAND_ONLY_CANONICAL_IDS,
  MINIMAX_SPEECH_BRAND_ONLY_CANONICAL_IDS,
  NANO_BANANA_BRAND_ONLY_CANONICAL_IDS,
  VEO_BRAND_ONLY_CANONICAL_IDS,
  OPENAI_BRAND_ONLY_CANONICAL_IDS,
  OPENAI_IMAGE_BRAND_ONLY_CANONICAL_IDS,
  VOLCANO_AI_MODEL_CATALOG,
} from "./ai-model-catalog";

export const SINGLE_MODEL_INTERFACE_CHANNEL = "single-model" as const;

export const DEEPSEEK_PROVIDER_CARD_ID = "provider:deepseek" as const;

export const DEEPSEEK_CANONICAL_IDS = [
  "deepseek-v4-pro",
  "deepseek-v4-flash",
] as const;

export type DeepSeekCanonicalId = (typeof DEEPSEEK_CANONICAL_IDS)[number];

export const DEEPSEEK_DEFAULT_ENDPOINT_URL =
  "https://api.deepseek.com" as const;

/** DeepSeek 官方 API 模型 id；与火山 catalog 的 providerModelId（带版本后缀）不同。 */
export const DEEPSEEK_DEFAULT_UPSTREAM_MODEL_IDS: Readonly<
  Record<DeepSeekCanonicalId, string>
> = {
  "deepseek-v4-pro": "deepseek-v4-pro",
  "deepseek-v4-flash": "deepseek-v4-flash",
} as const;

export const SEEDANCE_PROVIDER_CARD_ID = "provider:seedance" as const;

export const SEEDANCE_CANONICAL_IDS = [
  "doubao-seedance-2",
  "doubao-seedance-2-fast",
  "doubao-seedance-2-mini",
] as const;

export type SeedanceCanonicalId = (typeof SEEDANCE_CANONICAL_IDS)[number];

export const SEEDANCE_DEFAULT_ENDPOINT_URL =
  "https://ark.cn-beijing.volces.com/api/v3" as const;

export const SEEDREAM_PROVIDER_CARD_ID = "provider:seedream" as const;

export const SEEDREAM_CANONICAL_IDS = ["doubao-seedream-5"] as const;

export type SeedreamCanonicalId = (typeof SEEDREAM_CANONICAL_IDS)[number];

export const SEEDREAM_DEFAULT_ENDPOINT_URL =
  "https://ark.cn-beijing.volces.com/api/v3" as const;

export const SEED_PROVIDER_CARD_ID = "provider:seed" as const;

export const SEED_CANONICAL_IDS = ["doubao-seed-evolving"] as const;

export type SeedCanonicalId = (typeof SEED_CANONICAL_IDS)[number];

export const SEED_DEFAULT_ENDPOINT_URL =
  "https://ark.cn-beijing.volces.com/api/v3" as const;

export const GLM_PROVIDER_CARD_ID = "provider:glm" as const;

export const GLM_CANONICAL_IDS = ["glm-5-2"] as const;

export type GlmCanonicalId = (typeof GLM_CANONICAL_IDS)[number];

export const GLM_DEFAULT_ENDPOINT_URL =
  "https://ark.cn-beijing.volces.com/api/v3" as const;

export const KIMI_PROVIDER_CARD_ID = "provider:kimi" as const;

export const KIMI_CANONICAL_IDS = MOONSHOT_BRAND_ONLY_CANONICAL_IDS;

export type KimiCanonicalId = (typeof KIMI_CANONICAL_IDS)[number];

export const KIMI_DEFAULT_ENDPOINT_URL =
  "https://api.moonshot.cn/v1" as const;

export const KIMI_OVERSEAS_ENDPOINT_URL =
  "https://api.moonshot.ai/v1" as const;

export const KIMI_ENDPOINT_REGION_HINTS = [
  { region: "domestic" as const, url: KIMI_DEFAULT_ENDPOINT_URL },
  { region: "overseas" as const, url: KIMI_OVERSEAS_ENDPOINT_URL },
] as const;

export const OPENAI_PROVIDER_CARD_ID = "provider:openai" as const;

export const OPENAI_CANONICAL_IDS = OPENAI_BRAND_ONLY_CANONICAL_IDS;

export type OpenAiCanonicalId = (typeof OPENAI_CANONICAL_IDS)[number];

export const OPENAI_DEFAULT_ENDPOINT_URL =
  "https://api.openai.com/v1" as const;

/** OpenAI 官方 API 模型 id。 */
export const OPENAI_DEFAULT_UPSTREAM_MODEL_IDS: Readonly<
  Record<OpenAiCanonicalId, string>
> = {
  "gpt-5-6-sol": "gpt-5.6-sol",
  "gpt-5-6-terra": "gpt-5.6-terra",
  "gpt-5-6-luna": "gpt-5.6-luna",
} as const;

export const OPENAI_IMAGE_PROVIDER_CARD_ID = "provider:openai-image" as const;

export const OPENAI_IMAGE_CANONICAL_IDS = OPENAI_IMAGE_BRAND_ONLY_CANONICAL_IDS;

export type OpenAiImageCanonicalId = (typeof OPENAI_IMAGE_CANONICAL_IDS)[number];

export const OPENAI_IMAGE_DEFAULT_ENDPOINT_URL = OPENAI_DEFAULT_ENDPOINT_URL;

/** OpenAI 官方生图 API 模型 id。 */
export const OPENAI_IMAGE_DEFAULT_UPSTREAM_MODEL_IDS: Readonly<
  Record<OpenAiImageCanonicalId, string>
> = {
  "gpt-image-2": "gpt-image-2",
} as const;

export const GEMINI_PROVIDER_CARD_ID = "provider:gemini" as const;

export const GEMINI_CANONICAL_IDS = GEMINI_BRAND_ONLY_CANONICAL_IDS;

export type GeminiCanonicalId = (typeof GEMINI_CANONICAL_IDS)[number];

export const GEMINI_DEFAULT_ENDPOINT_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai" as const;

/** Google Gemini 官方 API 模型 id。 */
export const GEMINI_DEFAULT_UPSTREAM_MODEL_IDS: Readonly<
  Record<GeminiCanonicalId, string>
> = {
  "gemini-3-5-flash": "gemini-3.5-flash",
  "gemini-3-6-flash": "gemini-3.6-flash",
  "gemini-3-5-flash-lite": "gemini-3.5-flash-lite",
} as const;

export const NANO_BANANA_PROVIDER_CARD_ID = "provider:nano-banana" as const;

export const NANO_BANANA_CANONICAL_IDS = NANO_BANANA_BRAND_ONLY_CANONICAL_IDS;

export type NanoBananaCanonicalId = (typeof NANO_BANANA_CANONICAL_IDS)[number];

export const NANO_BANANA_DEFAULT_ENDPOINT_URL = GEMINI_DEFAULT_ENDPOINT_URL;

/** Google Nano Banana 官方生图 API 模型 id。 */
export const NANO_BANANA_DEFAULT_UPSTREAM_MODEL_IDS: Readonly<
  Record<NanoBananaCanonicalId, string>
> = {
  "gemini-3-1-flash-image": "gemini-3.1-flash-image",
  "gemini-3-1-flash-lite-image": "gemini-3.1-flash-lite-image",
  "gemini-3-pro-image": "gemini-3-pro-image",
} as const;

export const VEO_PROVIDER_CARD_ID = "provider:veo" as const;

export const VEO_CANONICAL_IDS = VEO_BRAND_ONLY_CANONICAL_IDS;

export type VeoCanonicalId = (typeof VEO_CANONICAL_IDS)[number];

export const VEO_DEFAULT_ENDPOINT_URL =
  "https://generativelanguage.googleapis.com/v1beta" as const;

/** Google Veo 官方视频 API 模型 id。 */
export const VEO_DEFAULT_UPSTREAM_MODEL_IDS: Readonly<
  Record<VeoCanonicalId, string>
> = {
  "veo-3-1-generate": "veo-3.1-generate-preview",
  "veo-3-1-fast-generate": "veo-3.1-fast-generate-preview",
  "veo-3-1-lite-generate": "veo-3.1-lite-generate-preview",
} as const;

export const GROK_PROVIDER_CARD_ID = "provider:grok" as const;

export const GROK_CANONICAL_IDS = GROK_BRAND_ONLY_CANONICAL_IDS;

export type GrokCanonicalId = (typeof GROK_CANONICAL_IDS)[number];

export const GROK_DEFAULT_ENDPOINT_URL = "https://api.x.ai/v1" as const;

/** xAI Grok 官方文字 API 模型 id。 */
export const GROK_DEFAULT_UPSTREAM_MODEL_IDS: Readonly<
  Record<GrokCanonicalId, string>
> = {
  "grok-4-5": "grok-4.5",
  "grok-4-3": "grok-4.3",
} as const;

export const GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID =
  "provider:grok-imagine-image" as const;

export const GROK_IMAGINE_IMAGE_CANONICAL_IDS =
  GROK_IMAGINE_IMAGE_BRAND_ONLY_CANONICAL_IDS;

export type GrokImagineImageCanonicalId =
  (typeof GROK_IMAGINE_IMAGE_CANONICAL_IDS)[number];

export const GROK_IMAGINE_IMAGE_DEFAULT_ENDPOINT_URL = GROK_DEFAULT_ENDPOINT_URL;

/** xAI Grok Imagine 官方生图 API 模型 id。 */
export const GROK_IMAGINE_IMAGE_DEFAULT_UPSTREAM_MODEL_IDS: Readonly<
  Record<GrokImagineImageCanonicalId, string>
> = {
  "grok-imagine-image": "grok-imagine-image",
  "grok-imagine-image-quality": "grok-imagine-image-quality",
} as const;

export const GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID =
  "provider:grok-imagine-video" as const;

export const GROK_IMAGINE_VIDEO_CANONICAL_IDS =
  GROK_IMAGINE_VIDEO_BRAND_ONLY_CANONICAL_IDS;

export type GrokImagineVideoCanonicalId =
  (typeof GROK_IMAGINE_VIDEO_CANONICAL_IDS)[number];

export const GROK_IMAGINE_VIDEO_DEFAULT_ENDPOINT_URL = GROK_DEFAULT_ENDPOINT_URL;

/** xAI Grok Imagine Video 官方视频 API 模型 id。 */
export const GROK_IMAGINE_VIDEO_DEFAULT_UPSTREAM_MODEL_IDS: Readonly<
  Record<GrokImagineVideoCanonicalId, string>
> = {
  "grok-imagine-video": "grok-imagine-video",
  "grok-imagine-video-1-5": "grok-imagine-video-1.5",
} as const;

export const CLAUDE_PROVIDER_CARD_ID = "provider:claude" as const;

export const CLAUDE_CANONICAL_IDS = CLAUDE_BRAND_ONLY_CANONICAL_IDS;

export type ClaudeCanonicalId = (typeof CLAUDE_CANONICAL_IDS)[number];

export const CLAUDE_DEFAULT_ENDPOINT_URL = "https://api.anthropic.com" as const;

/** Anthropic Claude 官方 Messages API 模型 id。 */
export const CLAUDE_DEFAULT_UPSTREAM_MODEL_IDS: Readonly<
  Record<ClaudeCanonicalId, string>
> = {
  "claude-sonnet-5": "claude-sonnet-5",
  "claude-opus-5": "claude-opus-5",
  "claude-haiku-4-5": "claude-haiku-4-5",
} as const;

export const MINIMAX_SPEECH_PROVIDER_CARD_ID =
  "provider:minimax-speech" as const;

export const MINIMAX_SPEECH_CANONICAL_IDS =
  MINIMAX_SPEECH_BRAND_ONLY_CANONICAL_IDS;

export type MinimaxSpeechCanonicalId =
  (typeof MINIMAX_SPEECH_CANONICAL_IDS)[number];

export const MINIMAX_SPEECH_DEFAULT_ENDPOINT_URL =
  "https://api.minimaxi.com" as const;

/** MiniMax 官方语音 API 模型 id。 */
export const MINIMAX_SPEECH_DEFAULT_UPSTREAM_MODEL_IDS: Readonly<
  Record<MinimaxSpeechCanonicalId, string>
> = {
  "minimax-speech-2-8-hd": "speech-2.8-hd",
  "minimax-speech-2-8-turbo": "speech-2.8-turbo",
} as const;

export interface SingleModelModelConfig {
  readonly enabled: boolean;
  readonly upstreamModelId: string;
  readonly modality: AiModelModality;
}

export interface SingleModelProviderMetadata {
  readonly channel: typeof SINGLE_MODEL_INTERFACE_CHANNEL;
  readonly singleModelPresetId: string;
  readonly singleModelCategory?: string;
  readonly models: Readonly<Record<string, SingleModelModelConfig>>;
  readonly tos?: {
    readonly accessKeyId: string;
    readonly region: string;
    readonly bucket?: string;
  };
}

/** @deprecated Use SingleModelProviderMetadata */
export interface SingleModelInterfaceMetadata {
  readonly channel: typeof SINGLE_MODEL_INTERFACE_CHANNEL;
  readonly canonicalId: string;
  readonly singleModelPresetId?: string;
  readonly singleModelCategory?: string;
  readonly tos?: SingleModelProviderMetadata["tos"];
}

export function isDeepSeekCanonicalId(
  value: string
): value is DeepSeekCanonicalId {
  return (DEEPSEEK_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isSeedanceCanonicalId(
  value: string
): value is SeedanceCanonicalId {
  return (SEEDANCE_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isSeedreamCanonicalId(
  value: string
): value is SeedreamCanonicalId {
  return (SEEDREAM_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isSeedCanonicalId(value: string): value is SeedCanonicalId {
  return (SEED_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isGlmCanonicalId(value: string): value is GlmCanonicalId {
  return (GLM_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isKimiCanonicalId(value: string): value is KimiCanonicalId {
  return (KIMI_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isOpenAiCanonicalId(value: string): value is OpenAiCanonicalId {
  return (OPENAI_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isOpenAiImageCanonicalId(
  value: string
): value is OpenAiImageCanonicalId {
  return (OPENAI_IMAGE_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isGeminiCanonicalId(value: string): value is GeminiCanonicalId {
  return (GEMINI_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isNanoBananaCanonicalId(
  value: string
): value is NanoBananaCanonicalId {
  return (NANO_BANANA_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isVeoCanonicalId(value: string): value is VeoCanonicalId {
  return (VEO_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isGrokCanonicalId(value: string): value is GrokCanonicalId {
  return (GROK_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isGrokImagineImageCanonicalId(
  value: string
): value is GrokImagineImageCanonicalId {
  return (GROK_IMAGINE_IMAGE_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isGrokImagineVideoCanonicalId(
  value: string
): value is GrokImagineVideoCanonicalId {
  return (GROK_IMAGINE_VIDEO_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isClaudeCanonicalId(value: string): value is ClaudeCanonicalId {
  return (CLAUDE_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isMinimaxSpeechCanonicalId(
  value: string
): value is MinimaxSpeechCanonicalId {
  return (MINIMAX_SPEECH_CANONICAL_IDS as readonly string[]).includes(value);
}

export function isSingleModelProviderMetadata(
  metadata: unknown
): metadata is SingleModelProviderMetadata {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }
  const record = metadata as Record<string, unknown>;
  if (record.channel !== SINGLE_MODEL_INTERFACE_CHANNEL) {
    return false;
  }
  return typeof record.models === "object" && record.models !== null;
}

export function isLegacySingleModelMetadata(
  metadata: unknown
): metadata is SingleModelInterfaceMetadata {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }
  const record = metadata as Record<string, unknown>;
  return (
    record.channel === SINGLE_MODEL_INTERFACE_CHANNEL &&
    typeof record.canonicalId === "string" &&
    !record.models
  );
}

export function readSingleModelPresetId(
  metadata: unknown
): string | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  const record = metadata as Record<string, unknown>;
  if (record.channel !== SINGLE_MODEL_INTERFACE_CHANNEL) {
    return undefined;
  }
  return typeof record.singleModelPresetId === "string" &&
    record.singleModelPresetId.trim()
    ? record.singleModelPresetId.trim()
    : undefined;
}

/** @deprecated Prefer models map on SingleModelProviderMetadata */
export function readSingleModelCanonicalId(
  metadata: unknown
): string | undefined {
  if (isSingleModelProviderMetadata(metadata)) {
    const enabled = Object.entries(metadata.models).find(
      ([, config]) => config.enabled
    );
    return enabled?.[0];
  }
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  const record = metadata as Record<string, unknown>;
  if (record.channel !== SINGLE_MODEL_INTERFACE_CHANNEL) {
    return undefined;
  }
  return typeof record.canonicalId === "string" && record.canonicalId.trim()
    ? record.canonicalId.trim()
    : undefined;
}

function catalogModalityFor(canonicalId: string): AiModelModality {
  return (
    VOLCANO_AI_MODEL_CATALOG.find((entry) => entry.canonicalId === canonicalId)
      ?.modality ?? "text"
  );
}

export function buildSingleModelProviderMetadata(params: {
  readonly singleModelPresetId: string;
  readonly singleModelCategory?: string;
  readonly models: readonly {
    readonly canonicalId: string;
    readonly upstreamModelId: string;
    readonly enabled?: boolean;
    readonly modality?: AiModelModality;
  }[];
  readonly tos?: SingleModelProviderMetadata["tos"];
}): SingleModelProviderMetadata {
  const models = Object.fromEntries(
    params.models.map((entry) => [
      entry.canonicalId,
      {
        enabled: entry.enabled ?? true,
        upstreamModelId: entry.upstreamModelId.trim(),
        modality: entry.modality ?? catalogModalityFor(entry.canonicalId),
      },
    ])
  );

  return {
    channel: SINGLE_MODEL_INTERFACE_CHANNEL,
    singleModelPresetId: params.singleModelPresetId,
    ...(params.singleModelCategory
      ? { singleModelCategory: params.singleModelCategory }
      : {}),
    models,
    ...(params.tos ? { tos: params.tos } : {}),
  };
}

/** @deprecated Use buildSingleModelProviderMetadata */
export function buildSingleModelInterfaceMetadata(params: {
  readonly canonicalId: string;
  readonly singleModelPresetId?: string;
  readonly singleModelCategory?: string;
  readonly tos?: SingleModelProviderMetadata["tos"];
}): SingleModelInterfaceMetadata {
  return {
    channel: SINGLE_MODEL_INTERFACE_CHANNEL,
    canonicalId: params.canonicalId,
    ...(params.singleModelPresetId
      ? { singleModelPresetId: params.singleModelPresetId }
      : {}),
    ...(params.singleModelCategory
      ? { singleModelCategory: params.singleModelCategory }
      : {}),
    ...(params.tos ? { tos: params.tos } : {}),
  };
}

export function isSingleModelAiInterface(params: {
  readonly provider: string;
  readonly metadata: unknown;
}): boolean {
  return (
    params.provider === "custom" &&
    isSingleModelProviderMetadata(params.metadata)
  );
}

export function mergeSingleModelModelEnabled(
  metadata: SingleModelProviderMetadata,
  toggles: Readonly<Record<string, boolean>>
): SingleModelProviderMetadata {
  const models = { ...metadata.models };
  for (const [canonicalId, enabled] of Object.entries(toggles)) {
    const existing = models[canonicalId];
    if (existing) {
      models[canonicalId] = { ...existing, enabled };
    }
  }
  return { ...metadata, models };
}

export function mergeSingleModelUpstreamModelIds(
  metadata: SingleModelProviderMetadata,
  updates: Readonly<Record<string, string>>
): SingleModelProviderMetadata {
  const models = { ...metadata.models };
  for (const [canonicalId, rawId] of Object.entries(updates)) {
    const existing = models[canonicalId];
    const upstreamModelId = rawId.trim();
    if (existing && upstreamModelId) {
      models[canonicalId] = { ...existing, upstreamModelId };
    }
  }
  return { ...metadata, models };
}

export function defaultUpstreamModelIdForCanonical(
  canonicalId: string
): string {
  if (isDeepSeekCanonicalId(canonicalId)) {
    return DEEPSEEK_DEFAULT_UPSTREAM_MODEL_IDS[canonicalId];
  }
  if (isOpenAiCanonicalId(canonicalId)) {
    return OPENAI_DEFAULT_UPSTREAM_MODEL_IDS[canonicalId];
  }
  if (isOpenAiImageCanonicalId(canonicalId)) {
    return OPENAI_IMAGE_DEFAULT_UPSTREAM_MODEL_IDS[canonicalId];
  }
  if (isGeminiCanonicalId(canonicalId)) {
    return GEMINI_DEFAULT_UPSTREAM_MODEL_IDS[canonicalId];
  }
  if (isNanoBananaCanonicalId(canonicalId)) {
    return NANO_BANANA_DEFAULT_UPSTREAM_MODEL_IDS[canonicalId];
  }
  if (isVeoCanonicalId(canonicalId)) {
    return VEO_DEFAULT_UPSTREAM_MODEL_IDS[canonicalId];
  }
  if (isGrokCanonicalId(canonicalId)) {
    return GROK_DEFAULT_UPSTREAM_MODEL_IDS[canonicalId];
  }
  if (isGrokImagineImageCanonicalId(canonicalId)) {
    return GROK_IMAGINE_IMAGE_DEFAULT_UPSTREAM_MODEL_IDS[canonicalId];
  }
  if (isGrokImagineVideoCanonicalId(canonicalId)) {
    return GROK_IMAGINE_VIDEO_DEFAULT_UPSTREAM_MODEL_IDS[canonicalId];
  }
  if (isClaudeCanonicalId(canonicalId)) {
    return CLAUDE_DEFAULT_UPSTREAM_MODEL_IDS[canonicalId];
  }
  if (isMinimaxSpeechCanonicalId(canonicalId)) {
    return MINIMAX_SPEECH_DEFAULT_UPSTREAM_MODEL_IDS[canonicalId];
  }
  const catalogEntry = VOLCANO_AI_MODEL_CATALOG.find(
    (entry) => entry.canonicalId === canonicalId
  );
  return catalogEntry?.providerModelId ?? canonicalId;
}
