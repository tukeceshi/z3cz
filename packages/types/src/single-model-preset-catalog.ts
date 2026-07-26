import { VOLCANO_AI_MODEL_CATALOG } from "./ai-model-catalog";
import {
  DEEPSEEK_CANONICAL_IDS,
  DEEPSEEK_DEFAULT_ENDPOINT_URL,
  DEEPSEEK_PROVIDER_CARD_ID,
  GLM_CANONICAL_IDS,
  GLM_DEFAULT_ENDPOINT_URL,
  GLM_PROVIDER_CARD_ID,
  KIMI_CANONICAL_IDS,
  KIMI_DEFAULT_ENDPOINT_URL,
  KIMI_ENDPOINT_REGION_HINTS,
  KIMI_OVERSEAS_ENDPOINT_URL,
  KIMI_PROVIDER_CARD_ID,
  OPENAI_CANONICAL_IDS,
  OPENAI_DEFAULT_ENDPOINT_URL,
  OPENAI_IMAGE_CANONICAL_IDS,
  OPENAI_IMAGE_DEFAULT_ENDPOINT_URL,
  OPENAI_IMAGE_PROVIDER_CARD_ID,
  OPENAI_PROVIDER_CARD_ID,
  GEMINI_CANONICAL_IDS,
  GEMINI_DEFAULT_ENDPOINT_URL,
  GEMINI_PROVIDER_CARD_ID,
  GROK_CANONICAL_IDS,
  GROK_DEFAULT_ENDPOINT_URL,
  GROK_IMAGINE_IMAGE_CANONICAL_IDS,
  GROK_IMAGINE_IMAGE_DEFAULT_ENDPOINT_URL,
  GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID,
  GROK_IMAGINE_VIDEO_CANONICAL_IDS,
  GROK_IMAGINE_VIDEO_DEFAULT_ENDPOINT_URL,
  GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID,
  GROK_PROVIDER_CARD_ID,
  MINIMAX_SPEECH_CANONICAL_IDS,
  MINIMAX_SPEECH_DEFAULT_ENDPOINT_URL,
  MINIMAX_SPEECH_PROVIDER_CARD_ID,
  CLAUDE_CANONICAL_IDS,
  CLAUDE_DEFAULT_ENDPOINT_URL,
  CLAUDE_PROVIDER_CARD_ID,
  NANO_BANANA_CANONICAL_IDS,
  NANO_BANANA_DEFAULT_ENDPOINT_URL,
  NANO_BANANA_PROVIDER_CARD_ID,
  VEO_CANONICAL_IDS,
  VEO_DEFAULT_ENDPOINT_URL,
  VEO_PROVIDER_CARD_ID,
  SEEDANCE_CANONICAL_IDS,
  SEEDANCE_DEFAULT_ENDPOINT_URL,
  SEEDANCE_PROVIDER_CARD_ID,
  SEED_CANONICAL_IDS,
  SEED_DEFAULT_ENDPOINT_URL,
  SEED_PROVIDER_CARD_ID,
  SEEDREAM_CANONICAL_IDS,
  SEEDREAM_DEFAULT_ENDPOINT_URL,
  SEEDREAM_PROVIDER_CARD_ID,
  defaultUpstreamModelIdForCanonical,
} from "./single-model-interface-metadata";

export type SingleModelPresetCategory = "text" | "image" | "video" | "audio" | "storage";

export type SingleModelPresetIcon =
  | "message-square"
  | "image"
  | "video"
  | "audio"
  | "hard-drive";

export type SingleModelPresetAuth = "apiKey" | "accessKey";

export interface SingleModelPresetEntry {
  readonly id: string;
  readonly category: SingleModelPresetCategory;
  readonly name: string;
  readonly icon: SingleModelPresetIcon;
  readonly auth: SingleModelPresetAuth;
  readonly canonicalId?: string;
  /** Base URL only — API path is appended at runtime when applicable. */
  readonly defaultEndpointUrl: string;
  readonly defaultModelId?: string;
  readonly defaultRegion?: string;
}

export const VOLCANO_ARK_SINGLE_MODEL_BASE_URL =
  "https://ark.cn-beijing.volces.com/api/v3" as const;

export const SINGLE_MODEL_PRESET_CATEGORIES: readonly SingleModelPresetCategory[] =
  ["text", "image", "video", "audio", "storage"] as const;

const DEEPSEEK_CANONICAL_ID_SET = new Set<string>(DEEPSEEK_CANONICAL_IDS);
const SEEDANCE_CANONICAL_ID_SET = new Set<string>(SEEDANCE_CANONICAL_IDS);
const SEEDREAM_CANONICAL_ID_SET = new Set<string>(SEEDREAM_CANONICAL_IDS);
const SEED_CANONICAL_ID_SET = new Set<string>(SEED_CANONICAL_IDS);
const GLM_CANONICAL_ID_SET = new Set<string>(GLM_CANONICAL_IDS);
const KIMI_CANONICAL_ID_SET = new Set<string>(KIMI_CANONICAL_IDS);
const OPENAI_CANONICAL_ID_SET = new Set<string>(OPENAI_CANONICAL_IDS);
const OPENAI_IMAGE_CANONICAL_ID_SET = new Set<string>(OPENAI_IMAGE_CANONICAL_IDS);
const GEMINI_CANONICAL_ID_SET = new Set<string>(GEMINI_CANONICAL_IDS);
const NANO_BANANA_CANONICAL_ID_SET = new Set<string>(NANO_BANANA_CANONICAL_IDS);
const VEO_CANONICAL_ID_SET = new Set<string>(VEO_CANONICAL_IDS);
const GROK_CANONICAL_ID_SET = new Set<string>(GROK_CANONICAL_IDS);
const GROK_IMAGINE_IMAGE_CANONICAL_ID_SET = new Set<string>(
  GROK_IMAGINE_IMAGE_CANONICAL_IDS
);
const GROK_IMAGINE_VIDEO_CANONICAL_ID_SET = new Set<string>(
  GROK_IMAGINE_VIDEO_CANONICAL_IDS
);
const MINIMAX_SPEECH_CANONICAL_ID_SET = new Set<string>(
  MINIMAX_SPEECH_CANONICAL_IDS
);
const CLAUDE_CANONICAL_ID_SET = new Set<string>(CLAUDE_CANONICAL_IDS);
const INDEPENDENT_PRESET_EXCLUDED_CANONICAL_IDS = new Set<string>([
  ...DEEPSEEK_CANONICAL_ID_SET,
  ...SEEDANCE_CANONICAL_ID_SET,
  ...SEEDREAM_CANONICAL_ID_SET,
  ...SEED_CANONICAL_ID_SET,
  ...GLM_CANONICAL_ID_SET,
  ...KIMI_CANONICAL_ID_SET,
  ...OPENAI_CANONICAL_ID_SET,
  ...OPENAI_IMAGE_CANONICAL_ID_SET,
  ...GEMINI_CANONICAL_ID_SET,
  ...NANO_BANANA_CANONICAL_ID_SET,
  ...VEO_CANONICAL_ID_SET,
  ...GROK_CANONICAL_ID_SET,
  ...GROK_IMAGINE_IMAGE_CANONICAL_ID_SET,
  ...GROK_IMAGINE_VIDEO_CANONICAL_ID_SET,
  ...MINIMAX_SPEECH_CANONICAL_ID_SET,
  ...CLAUDE_CANONICAL_ID_SET,
]);

const MODEL_ENDPOINT_PATH: Record<
  Exclude<SingleModelPresetCategory, "storage">,
  string
> = {
  text: "/chat/completions",
  image: "/images/generations",
  video: "/contents/generations/tasks",
  audio: "/v1/t2a_v2",
};

const MODEL_ICON: Record<
  Exclude<SingleModelPresetCategory, "storage">,
  SingleModelPresetIcon
> = {
  text: "message-square",
  image: "image",
  video: "video",
  audio: "audio",
};

function buildIndependentModelPresets(): readonly SingleModelPresetEntry[] {
  return VOLCANO_AI_MODEL_CATALOG.filter(
    (entry) => !INDEPENDENT_PRESET_EXCLUDED_CANONICAL_IDS.has(entry.canonicalId)
  ).map((entry) => {
    const category = entry.modality as Exclude<
      SingleModelPresetCategory,
      "storage"
    >;
    return {
      id: `preset:${entry.canonicalId}`,
      category,
      name: entry.alias,
      icon: MODEL_ICON[category],
      auth: "apiKey",
      canonicalId: entry.canonicalId,
      defaultEndpointUrl: VOLCANO_ARK_SINGLE_MODEL_BASE_URL,
      defaultModelId: entry.providerModelId,
    } satisfies SingleModelPresetEntry;
  });
}

export const SINGLE_MODEL_PRESET_CATALOG: readonly SingleModelPresetEntry[] = [
  ...buildIndependentModelPresets(),
] as const;

export {
  DEEPSEEK_CANONICAL_IDS,
  DEEPSEEK_DEFAULT_ENDPOINT_URL,
  DEEPSEEK_PROVIDER_CARD_ID,
  GLM_CANONICAL_IDS,
  GLM_DEFAULT_ENDPOINT_URL,
  GLM_PROVIDER_CARD_ID,
  KIMI_CANONICAL_IDS,
  KIMI_DEFAULT_ENDPOINT_URL,
  KIMI_ENDPOINT_REGION_HINTS,
  KIMI_OVERSEAS_ENDPOINT_URL,
  KIMI_PROVIDER_CARD_ID,
  OPENAI_CANONICAL_IDS,
  OPENAI_DEFAULT_ENDPOINT_URL,
  OPENAI_IMAGE_CANONICAL_IDS,
  OPENAI_IMAGE_DEFAULT_ENDPOINT_URL,
  OPENAI_IMAGE_PROVIDER_CARD_ID,
  OPENAI_PROVIDER_CARD_ID,
  GEMINI_CANONICAL_IDS,
  GEMINI_DEFAULT_ENDPOINT_URL,
  GEMINI_PROVIDER_CARD_ID,
  GROK_CANONICAL_IDS,
  GROK_DEFAULT_ENDPOINT_URL,
  GROK_IMAGINE_IMAGE_CANONICAL_IDS,
  GROK_IMAGINE_IMAGE_DEFAULT_ENDPOINT_URL,
  GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID,
  GROK_IMAGINE_VIDEO_CANONICAL_IDS,
  GROK_IMAGINE_VIDEO_DEFAULT_ENDPOINT_URL,
  GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID,
  GROK_PROVIDER_CARD_ID,
  MINIMAX_SPEECH_CANONICAL_IDS,
  MINIMAX_SPEECH_DEFAULT_ENDPOINT_URL,
  MINIMAX_SPEECH_PROVIDER_CARD_ID,
  CLAUDE_CANONICAL_IDS,
  CLAUDE_DEFAULT_ENDPOINT_URL,
  CLAUDE_PROVIDER_CARD_ID,
  NANO_BANANA_CANONICAL_IDS,
  NANO_BANANA_DEFAULT_ENDPOINT_URL,
  NANO_BANANA_PROVIDER_CARD_ID,
  VEO_CANONICAL_IDS,
  VEO_DEFAULT_ENDPOINT_URL,
  VEO_PROVIDER_CARD_ID,
  SEEDANCE_CANONICAL_IDS,
  SEEDANCE_DEFAULT_ENDPOINT_URL,
  SEEDANCE_PROVIDER_CARD_ID,
  SEED_CANONICAL_IDS,
  SEED_DEFAULT_ENDPOINT_URL,
  SEED_PROVIDER_CARD_ID,
  SEEDREAM_CANONICAL_IDS,
  SEEDREAM_DEFAULT_ENDPOINT_URL,
  SEEDREAM_PROVIDER_CARD_ID,
  defaultUpstreamModelIdForCanonical,
};

export function getSingleModelPresetById(
  id: string
): SingleModelPresetEntry | undefined {
  if (!id) {
    return undefined;
  }
  return SINGLE_MODEL_PRESET_CATALOG.find((entry) => entry.id === id);
}

export function getSingleModelPresetsByCategory(): Readonly<
  Record<SingleModelPresetCategory, readonly SingleModelPresetEntry[]>
> {
  const grouped: Record<
    SingleModelPresetCategory,
    SingleModelPresetEntry[]
  > = {
    text: [],
    image: [],
    video: [],
    audio: [],
    storage: [],
  };

  for (const entry of SINGLE_MODEL_PRESET_CATALOG) {
    grouped[entry.category].push(entry);
  }

  return grouped;
}

export function buildVolcanoTosEndpointUrl(region: string): string {
  return `https://tos-${region}.volces.com`;
}

export function getSingleModelApiPath(
  category: SingleModelPresetCategory
): string | undefined {
  if (category === "storage") {
    return undefined;
  }
  return MODEL_ENDPOINT_PATH[category];
}

export function getDefaultSingleModelPresetId(): string {
  const firstText = SINGLE_MODEL_PRESET_CATALOG.find(
    (entry) => entry.category === "text"
  );
  return firstText?.id ?? SINGLE_MODEL_PRESET_CATALOG[0]!.id;
}

export function getDefaultSingleModelCategory(): SingleModelPresetCategory {
  return "text";
}

export function isDeepSeekProviderSelection(
  selection: SingleModelWizardSelection
): selection is DeepSeekWizardSelection {
  return selection.kind === "deepseek";
}

export function isSeedanceProviderSelection(
  selection: SingleModelWizardSelection
): selection is SeedanceWizardSelection {
  return selection.kind === "seedance";
}

export function isSeedreamProviderSelection(
  selection: SingleModelWizardSelection
): selection is SeedreamWizardSelection {
  return selection.kind === "seedream";
}

export function isSeedProviderSelection(
  selection: SingleModelWizardSelection
): selection is SeedWizardSelection {
  return selection.kind === "seed";
}

export function isGlmProviderSelection(
  selection: SingleModelWizardSelection
): selection is GlmWizardSelection {
  return selection.kind === "glm";
}

export function isKimiProviderSelection(
  selection: SingleModelWizardSelection
): selection is KimiWizardSelection {
  return selection.kind === "kimi";
}

export function isOpenAiProviderSelection(
  selection: SingleModelWizardSelection
): selection is OpenAiWizardSelection {
  return selection.kind === "openai";
}

export function isOpenAiImageProviderSelection(
  selection: SingleModelWizardSelection
): selection is OpenAiImageWizardSelection {
  return selection.kind === "openai-image";
}

export function isGeminiProviderSelection(
  selection: SingleModelWizardSelection
): selection is GeminiWizardSelection {
  return selection.kind === "gemini";
}

export function isNanoBananaProviderSelection(
  selection: SingleModelWizardSelection
): selection is NanoBananaWizardSelection {
  return selection.kind === "nano-banana";
}

export function isVeoProviderSelection(
  selection: SingleModelWizardSelection
): selection is VeoWizardSelection {
  return selection.kind === "veo";
}

export function isGrokProviderSelection(
  selection: SingleModelWizardSelection
): selection is GrokWizardSelection {
  return selection.kind === "grok";
}

export function isGrokImagineImageProviderSelection(
  selection: SingleModelWizardSelection
): selection is GrokImagineImageWizardSelection {
  return selection.kind === "grok-imagine-image";
}

export function isGrokImagineVideoProviderSelection(
  selection: SingleModelWizardSelection
): selection is GrokImagineVideoWizardSelection {
  return selection.kind === "grok-imagine-video";
}

export function isClaudeProviderSelection(
  selection: SingleModelWizardSelection
): selection is ClaudeWizardSelection {
  return selection.kind === "claude";
}

export function isMinimaxSpeechProviderSelection(
  selection: SingleModelWizardSelection
): selection is MinimaxSpeechWizardSelection {
  return selection.kind === "minimax-speech";
}

export function isMultiModelProviderSelection(
  selection: SingleModelWizardSelection
): selection is
  | DeepSeekWizardSelection
  | SeedanceWizardSelection
  | SeedreamWizardSelection
  | SeedWizardSelection
  | GlmWizardSelection
  | KimiWizardSelection
  | OpenAiWizardSelection
  | OpenAiImageWizardSelection
  | GeminiWizardSelection
  | NanoBananaWizardSelection
  | VeoWizardSelection
  | GrokWizardSelection
  | GrokImagineImageWizardSelection
  | GrokImagineVideoWizardSelection
  | ClaudeWizardSelection
  | MinimaxSpeechWizardSelection {
  return (
    selection.kind === "deepseek" ||
    selection.kind === "seedance" ||
    selection.kind === "seedream" ||
    selection.kind === "seed" ||
    selection.kind === "glm" ||
    selection.kind === "kimi" ||
    selection.kind === "openai" ||
    selection.kind === "openai-image" ||
    selection.kind === "gemini" ||
    selection.kind === "nano-banana" ||
    selection.kind === "veo" ||
    selection.kind === "grok" ||
    selection.kind === "grok-imagine-image" ||
    selection.kind === "grok-imagine-video" ||
    selection.kind === "claude" ||
    selection.kind === "minimax-speech"
  );
}

export interface PresetWizardSelection {
  readonly kind: "preset";
  readonly presetId: string;
}

export interface DeepSeekWizardSelection {
  readonly kind: "deepseek";
  readonly checkedCanonicalIds: readonly string[];
}

export interface SeedanceWizardSelection {
  readonly kind: "seedance";
  readonly checkedCanonicalIds: readonly string[];
}

export interface SeedreamWizardSelection {
  readonly kind: "seedream";
  readonly checkedCanonicalIds: readonly string[];
}

export interface SeedWizardSelection {
  readonly kind: "seed";
  readonly checkedCanonicalIds: readonly string[];
}

export interface GlmWizardSelection {
  readonly kind: "glm";
  readonly checkedCanonicalIds: readonly string[];
}

export interface KimiWizardSelection {
  readonly kind: "kimi";
  readonly checkedCanonicalIds: readonly string[];
}

export interface OpenAiWizardSelection {
  readonly kind: "openai";
  readonly checkedCanonicalIds: readonly string[];
}

export interface OpenAiImageWizardSelection {
  readonly kind: "openai-image";
  readonly checkedCanonicalIds: readonly string[];
}

export interface GeminiWizardSelection {
  readonly kind: "gemini";
  readonly checkedCanonicalIds: readonly string[];
}

export interface NanoBananaWizardSelection {
  readonly kind: "nano-banana";
  readonly checkedCanonicalIds: readonly string[];
}

export interface VeoWizardSelection {
  readonly kind: "veo";
  readonly checkedCanonicalIds: readonly string[];
}

export interface GrokWizardSelection {
  readonly kind: "grok";
  readonly checkedCanonicalIds: readonly string[];
}

export interface GrokImagineImageWizardSelection {
  readonly kind: "grok-imagine-image";
  readonly checkedCanonicalIds: readonly string[];
}

export interface GrokImagineVideoWizardSelection {
  readonly kind: "grok-imagine-video";
  readonly checkedCanonicalIds: readonly string[];
}

export interface ClaudeWizardSelection {
  readonly kind: "claude";
  readonly checkedCanonicalIds: readonly string[];
}

export interface MinimaxSpeechWizardSelection {
  readonly kind: "minimax-speech";
  readonly checkedCanonicalIds: readonly string[];
}

export type SingleModelWizardSelection =
  | PresetWizardSelection
  | DeepSeekWizardSelection
  | SeedanceWizardSelection
  | SeedreamWizardSelection
  | SeedWizardSelection
  | GlmWizardSelection
  | KimiWizardSelection
  | OpenAiWizardSelection
  | OpenAiImageWizardSelection
  | GeminiWizardSelection
  | NanoBananaWizardSelection
  | VeoWizardSelection
  | GrokWizardSelection
  | GrokImagineImageWizardSelection
  | GrokImagineVideoWizardSelection
  | ClaudeWizardSelection
  | MinimaxSpeechWizardSelection;

export function createDefaultDeepSeekSelection(
  enabledCanonicalIds: readonly string[]
): DeepSeekWizardSelection {
  return {
    kind: "deepseek",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultSeedanceSelection(
  enabledCanonicalIds: readonly string[]
): SeedanceWizardSelection {
  return {
    kind: "seedance",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultSeedreamSelection(
  enabledCanonicalIds: readonly string[]
): SeedreamWizardSelection {
  return {
    kind: "seedream",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultSeedSelection(
  enabledCanonicalIds: readonly string[]
): SeedWizardSelection {
  return {
    kind: "seed",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultGlmSelection(
  enabledCanonicalIds: readonly string[]
): GlmWizardSelection {
  return {
    kind: "glm",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultKimiSelection(
  enabledCanonicalIds: readonly string[]
): KimiWizardSelection {
  return {
    kind: "kimi",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultOpenAiSelection(
  enabledCanonicalIds: readonly string[]
): OpenAiWizardSelection {
  return {
    kind: "openai",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultOpenAiImageSelection(
  enabledCanonicalIds: readonly string[]
): OpenAiImageWizardSelection {
  return {
    kind: "openai-image",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultGeminiSelection(
  enabledCanonicalIds: readonly string[]
): GeminiWizardSelection {
  return {
    kind: "gemini",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultNanoBananaSelection(
  enabledCanonicalIds: readonly string[]
): NanoBananaWizardSelection {
  return {
    kind: "nano-banana",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultVeoSelection(
  enabledCanonicalIds: readonly string[]
): VeoWizardSelection {
  return {
    kind: "veo",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultGrokSelection(
  enabledCanonicalIds: readonly string[]
): GrokWizardSelection {
  return {
    kind: "grok",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultGrokImagineImageSelection(
  enabledCanonicalIds: readonly string[]
): GrokImagineImageWizardSelection {
  return {
    kind: "grok-imagine-image",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultGrokImagineVideoSelection(
  enabledCanonicalIds: readonly string[]
): GrokImagineVideoWizardSelection {
  return {
    kind: "grok-imagine-video",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultClaudeSelection(
  enabledCanonicalIds: readonly string[]
): ClaudeWizardSelection {
  return {
    kind: "claude",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createDefaultMinimaxSpeechSelection(
  enabledCanonicalIds: readonly string[]
): MinimaxSpeechWizardSelection {
  return {
    kind: "minimax-speech",
    checkedCanonicalIds: [...enabledCanonicalIds],
  };
}

export function createEmptyPresetSelection(): PresetWizardSelection {
  return {
    kind: "preset",
    presetId: "",
  };
}

export function createDefaultPresetSelection(): PresetWizardSelection {
  return {
    kind: "preset",
    presetId: getDefaultSingleModelPresetId(),
  };
}
