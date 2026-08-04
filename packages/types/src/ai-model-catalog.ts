export type AiModelModality = "text" | "image" | "video" | "audio";

export interface AiModelCatalogEntry {
  readonly canonicalId: string;
  readonly alias: string;
  readonly modality: AiModelModality;
  readonly providerModelId: string;
}

/** Moonshot 官方 API 模型；不参与火山聚合 catalog 合并与向导。 */
export const MOONSHOT_BRAND_ONLY_CANONICAL_IDS = [
  "kimi-k3",
  "kimi-k2.6",
  "kimi-k2.5",
] as const;

/** OpenAI 官方 API 文字模型；不参与火山聚合 catalog 合并与向导。 */
export const OPENAI_BRAND_ONLY_CANONICAL_IDS = [
  "gpt-5-6-sol",
  "gpt-5-6-terra",
  "gpt-5-6-luna",
] as const;

/** OpenAI 官方 API 生图模型；不参与火山聚合 catalog 合并与向导。 */
export const OPENAI_IMAGE_BRAND_ONLY_CANONICAL_IDS = ["gpt-image-2"] as const;

/** Google Gemini 官方 API 文字模型；不参与火山聚合 catalog 合并与向导。 */
export const GEMINI_BRAND_ONLY_CANONICAL_IDS = [
  "gemini-3-5-flash",
  "gemini-3-6-flash",
  "gemini-3-5-flash-lite",
] as const;

/** Google Nano Banana 官方 API 生图模型；不参与火山聚合 catalog 合并与向导。 */
export const NANO_BANANA_BRAND_ONLY_CANONICAL_IDS = [
  "gemini-3-1-flash-image",
  "gemini-3-1-flash-lite-image",
  "gemini-3-pro-image",
] as const;

/** Google Veo 官方 API 视频模型；不参与火山聚合 catalog 合并与向导。 */
export const VEO_BRAND_ONLY_CANONICAL_IDS = [
  "veo-3-1-generate",
  "veo-3-1-fast-generate",
  "veo-3-1-lite-generate",
] as const;

/** xAI Grok 官方 API 文字模型；不参与火山聚合 catalog 合并与向导。 */
export const GROK_BRAND_ONLY_CANONICAL_IDS = [
  "grok-4-5",
  "grok-4-3",
] as const;

/** xAI Grok Imagine 官方 API 生图模型；不参与火山聚合 catalog 合并与向导。 */
export const GROK_IMAGINE_IMAGE_BRAND_ONLY_CANONICAL_IDS = [
  "grok-imagine-image",
  "grok-imagine-image-quality",
] as const;

/** xAI Grok Imagine Video 官方 API 视频模型；不参与火山聚合 catalog 合并与向导。 */
export const GROK_IMAGINE_VIDEO_BRAND_ONLY_CANONICAL_IDS = [
  "grok-imagine-video",
  "grok-imagine-video-1-5",
] as const;

/** Anthropic Claude 官方 API 文字模型；不参与火山聚合 catalog 合并与向导。 */
export const CLAUDE_BRAND_ONLY_CANONICAL_IDS = [
  "claude-sonnet-5",
  "claude-opus-5",
  "claude-haiku-4-5",
] as const;

/** MiniMax 官方 API 语音模型；不参与火山聚合 catalog 合并与向导。 */
export const MINIMAX_SPEECH_BRAND_ONLY_CANONICAL_IDS = [
  "minimax-speech-2-8-hd",
  "minimax-speech-2-8-turbo",
] as const;

export function isMoonshotBrandOnlyCanonicalId(canonicalId: string): boolean {
  return (MOONSHOT_BRAND_ONLY_CANONICAL_IDS as readonly string[]).includes(
    canonicalId
  );
}

export function isOpenAiBrandOnlyCanonicalId(canonicalId: string): boolean {
  return (OPENAI_BRAND_ONLY_CANONICAL_IDS as readonly string[]).includes(
    canonicalId
  );
}

export function isOpenAiImageBrandOnlyCanonicalId(canonicalId: string): boolean {
  return (OPENAI_IMAGE_BRAND_ONLY_CANONICAL_IDS as readonly string[]).includes(
    canonicalId
  );
}

export function isGeminiBrandOnlyCanonicalId(canonicalId: string): boolean {
  return (GEMINI_BRAND_ONLY_CANONICAL_IDS as readonly string[]).includes(
    canonicalId
  );
}

export function isNanoBananaBrandOnlyCanonicalId(canonicalId: string): boolean {
  return (NANO_BANANA_BRAND_ONLY_CANONICAL_IDS as readonly string[]).includes(
    canonicalId
  );
}

export function isVeoBrandOnlyCanonicalId(canonicalId: string): boolean {
  return (VEO_BRAND_ONLY_CANONICAL_IDS as readonly string[]).includes(
    canonicalId
  );
}

export function isGrokBrandOnlyCanonicalId(canonicalId: string): boolean {
  return (GROK_BRAND_ONLY_CANONICAL_IDS as readonly string[]).includes(
    canonicalId
  );
}

export function isGrokImagineImageBrandOnlyCanonicalId(
  canonicalId: string
): boolean {
  return (
    GROK_IMAGINE_IMAGE_BRAND_ONLY_CANONICAL_IDS as readonly string[]
  ).includes(canonicalId);
}

export function isGrokImagineVideoBrandOnlyCanonicalId(
  canonicalId: string
): boolean {
  return (
    GROK_IMAGINE_VIDEO_BRAND_ONLY_CANONICAL_IDS as readonly string[]
  ).includes(canonicalId);
}

export function isClaudeBrandOnlyCanonicalId(canonicalId: string): boolean {
  return (CLAUDE_BRAND_ONLY_CANONICAL_IDS as readonly string[]).includes(
    canonicalId
  );
}

export function isMinimaxSpeechBrandOnlyCanonicalId(
  canonicalId: string
): boolean {
  return (MINIMAX_SPEECH_BRAND_ONLY_CANONICAL_IDS as readonly string[]).includes(
    canonicalId
  );
}

export function isExternalBrandOnlyCanonicalId(canonicalId: string): boolean {
  return (
    isMoonshotBrandOnlyCanonicalId(canonicalId) ||
    isOpenAiBrandOnlyCanonicalId(canonicalId) ||
    isOpenAiImageBrandOnlyCanonicalId(canonicalId) ||
    isGeminiBrandOnlyCanonicalId(canonicalId) ||
    isNanoBananaBrandOnlyCanonicalId(canonicalId) ||
    isVeoBrandOnlyCanonicalId(canonicalId) ||
    isGrokBrandOnlyCanonicalId(canonicalId) ||
    isGrokImagineImageBrandOnlyCanonicalId(canonicalId) ||
    isGrokImagineVideoBrandOnlyCanonicalId(canonicalId) ||
    isClaudeBrandOnlyCanonicalId(canonicalId) ||
    isMinimaxSpeechBrandOnlyCanonicalId(canonicalId)
  );
}

export const VOLCANO_AI_MODEL_CATALOG: readonly AiModelCatalogEntry[] = [
  {
    canonicalId: "doubao-seed-evolving",
    alias: "Doubao Seed Evolving",
    modality: "text",
    providerModelId: "doubao-seed-evolving",
  },
  {
    canonicalId: "deepseek-v4-pro",
    alias: "DeepSeek V4 Pro",
    modality: "text",
    providerModelId: "deepseek-v4-pro-260425",
  },
  {
    canonicalId: "deepseek-v4-flash",
    alias: "DeepSeek V4 Flash",
    modality: "text",
    providerModelId: "deepseek-v4-flash-260425",
  },
  {
    canonicalId: "glm-5-2",
    alias: "GLM-5.2",
    modality: "text",
    providerModelId: "glm-5-2-260617",
  },
  {
    canonicalId: "kimi-k3",
    alias: "Kimi K3",
    modality: "text",
    providerModelId: "kimi-k3",
  },
  {
    canonicalId: "kimi-k2.6",
    alias: "Kimi K2.6",
    modality: "text",
    providerModelId: "kimi-k2.6",
  },
  {
    canonicalId: "kimi-k2.5",
    alias: "Kimi K2.5",
    modality: "text",
    providerModelId: "kimi-k2.5",
  },
  {
    canonicalId: "gpt-5-6-sol",
    alias: "GPT-5.6 Sol",
    modality: "text",
    providerModelId: "gpt-5.6-sol",
  },
  {
    canonicalId: "gpt-5-6-terra",
    alias: "GPT-5.6 Terra",
    modality: "text",
    providerModelId: "gpt-5.6-terra",
  },
  {
    canonicalId: "gpt-5-6-luna",
    alias: "GPT-5.6 Luna",
    modality: "text",
    providerModelId: "gpt-5.6-luna",
  },
  {
    canonicalId: "gpt-image-2",
    alias: "GPT Image 2",
    modality: "image",
    providerModelId: "gpt-image-2",
  },
  {
    canonicalId: "gemini-3-5-flash",
    alias: "Gemini 3.5 Flash",
    modality: "text",
    providerModelId: "gemini-3.5-flash",
  },
  {
    canonicalId: "gemini-3-6-flash",
    alias: "Gemini 3.6 Flash",
    modality: "text",
    providerModelId: "gemini-3.6-flash",
  },
  {
    canonicalId: "gemini-3-5-flash-lite",
    alias: "Gemini 3.5 Flash-Lite",
    modality: "text",
    providerModelId: "gemini-3.5-flash-lite",
  },
  {
    canonicalId: "gemini-3-1-flash-image",
    alias: "Nano Banana 2",
    modality: "image",
    providerModelId: "gemini-3.1-flash-image",
  },
  {
    canonicalId: "gemini-3-1-flash-lite-image",
    alias: "Nano Banana 2 Lite",
    modality: "image",
    providerModelId: "gemini-3.1-flash-lite-image",
  },
  {
    canonicalId: "gemini-3-pro-image",
    alias: "Nano Banana Pro",
    modality: "image",
    providerModelId: "gemini-3-pro-image",
  },
  {
    canonicalId: "veo-3-1-generate",
    alias: "Veo 3.1",
    modality: "video",
    providerModelId: "veo-3.1-generate-preview",
  },
  {
    canonicalId: "veo-3-1-fast-generate",
    alias: "Veo 3.1 Fast",
    modality: "video",
    providerModelId: "veo-3.1-fast-generate-preview",
  },
  {
    canonicalId: "veo-3-1-lite-generate",
    alias: "Veo 3.1 Lite",
    modality: "video",
    providerModelId: "veo-3.1-lite-generate-preview",
  },
  {
    canonicalId: "grok-4-5",
    alias: "Grok 4.5",
    modality: "text",
    providerModelId: "grok-4.5",
  },
  {
    canonicalId: "grok-4-3",
    alias: "Grok 4.3",
    modality: "text",
    providerModelId: "grok-4.3",
  },
  {
    canonicalId: "grok-imagine-image",
    alias: "Grok Imagine",
    modality: "image",
    providerModelId: "grok-imagine-image",
  },
  {
    canonicalId: "grok-imagine-image-quality",
    alias: "Grok Imagine Quality",
    modality: "image",
    providerModelId: "grok-imagine-image-quality",
  },
  {
    canonicalId: "grok-imagine-video",
    alias: "Grok Imagine Video",
    modality: "video",
    providerModelId: "grok-imagine-video",
  },
  {
    canonicalId: "grok-imagine-video-1-5",
    alias: "Grok Imagine Video 1.5",
    modality: "video",
    providerModelId: "grok-imagine-video-1.5",
  },
  {
    canonicalId: "claude-sonnet-5",
    alias: "Claude Sonnet 5",
    modality: "text",
    providerModelId: "claude-sonnet-5",
  },
  {
    canonicalId: "claude-opus-5",
    alias: "Claude Opus 5",
    modality: "text",
    providerModelId: "claude-opus-5",
  },
  {
    canonicalId: "claude-haiku-4-5",
    alias: "Claude Haiku 4.5",
    modality: "text",
    providerModelId: "claude-haiku-4-5",
  },
  {
    canonicalId: "minimax-speech-2-8-hd",
    alias: "MiniMax Speech 2.8 HD",
    modality: "audio",
    providerModelId: "speech-2.8-hd",
  },
  {
    canonicalId: "minimax-speech-2-8-turbo",
    alias: "MiniMax Speech 2.8 Turbo",
    modality: "audio",
    providerModelId: "speech-2.8-turbo",
  },
  {
    canonicalId: "doubao-seedance-2",
    alias: "Seedance 2.0",
    modality: "video",
    providerModelId: "doubao-seedance-2-0-260128",
  },
  {
    canonicalId: "doubao-seedance-2-fast",
    alias: "Seedance 2.0 Fast",
    modality: "video",
    providerModelId: "doubao-seedance-2-0-fast-260128",
  },
  {
    canonicalId: "doubao-seedance-2-mini",
    alias: "Seedance 2.0 Mini",
    modality: "video",
    providerModelId: "doubao-seedance-2-0-mini-260615",
  },
  {
    canonicalId: "doubao-seedream-5",
    alias: "Seedream 5.0 lite",
    modality: "image",
    providerModelId: "doubao-seedream-5-0-260128",
  },
] as const;

export const VOLCANO_AGGREGATE_MODEL_CATALOG: readonly AiModelCatalogEntry[] =
  VOLCANO_AI_MODEL_CATALOG.filter(
    (entry) => !isExternalBrandOnlyCanonicalId(entry.canonicalId)
  );

/** @deprecated Prefer `provider === "doubao_volcano"`. Kept for reading legacy rows. */
export const VOLCANO_TEMPLATE_ID = "doubao-volcano-chat-v1" as const;

export function isVolcanoAiInterfaceProvider(
  provider: string | null | undefined
): boolean {
  return provider === "doubao_volcano";
}

export const VOLCANO_ARK_API_KEY_DURATION_SECONDS = 2_592_000 as const;
