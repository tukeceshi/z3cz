import { VOLCANO_AGGREGATE_MODEL_CATALOG } from "./ai-model-catalog";
import type { PlatformAiModelChannel } from "./platform-ai-model-channel";
import { VOLCANO_AGGREGATE_PRESET_ID } from "./platform-ai-model-channel";
import {
  CLAUDE_CANONICAL_IDS,
  CLAUDE_PROVIDER_CARD_ID,
  DEEPSEEK_CANONICAL_IDS,
  DEEPSEEK_PROVIDER_CARD_ID,
  GEMINI_CANONICAL_IDS,
  GEMINI_PROVIDER_CARD_ID,
  GLM_CANONICAL_IDS,
  GLM_PROVIDER_CARD_ID,
  GROK_CANONICAL_IDS,
  GROK_IMAGINE_IMAGE_CANONICAL_IDS,
  GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID,
  GROK_IMAGINE_VIDEO_CANONICAL_IDS,
  GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID,
  GROK_PROVIDER_CARD_ID,
  KIMI_CANONICAL_IDS,
  KIMI_PROVIDER_CARD_ID,
  MINIMAX_SPEECH_CANONICAL_IDS,
  MINIMAX_SPEECH_PROVIDER_CARD_ID,
  NANO_BANANA_CANONICAL_IDS,
  NANO_BANANA_PROVIDER_CARD_ID,
  OPENAI_CANONICAL_IDS,
  OPENAI_IMAGE_CANONICAL_IDS,
  OPENAI_IMAGE_PROVIDER_CARD_ID,
  OPENAI_PROVIDER_CARD_ID,
  SEEDANCE_CANONICAL_IDS,
  SEEDANCE_PROVIDER_CARD_ID,
  SEED_CANONICAL_IDS,
  SEED_PROVIDER_CARD_ID,
  SEEDREAM_CANONICAL_IDS,
  SEEDREAM_PROVIDER_CARD_ID,
  VEO_CANONICAL_IDS,
  VEO_PROVIDER_CARD_ID,
  defaultUpstreamModelIdForCanonical,
} from "./single-model-interface-metadata";

const API_BRAND_CHANNELS: readonly {
  readonly presetId: string;
  readonly canonicalIds: readonly string[];
}[] = [
  { presetId: DEEPSEEK_PROVIDER_CARD_ID, canonicalIds: DEEPSEEK_CANONICAL_IDS },
  { presetId: SEEDANCE_PROVIDER_CARD_ID, canonicalIds: SEEDANCE_CANONICAL_IDS },
  { presetId: SEEDREAM_PROVIDER_CARD_ID, canonicalIds: SEEDREAM_CANONICAL_IDS },
  { presetId: SEED_PROVIDER_CARD_ID, canonicalIds: SEED_CANONICAL_IDS },
  { presetId: GLM_PROVIDER_CARD_ID, canonicalIds: GLM_CANONICAL_IDS },
  { presetId: KIMI_PROVIDER_CARD_ID, canonicalIds: KIMI_CANONICAL_IDS },
  { presetId: OPENAI_PROVIDER_CARD_ID, canonicalIds: OPENAI_CANONICAL_IDS },
  {
    presetId: OPENAI_IMAGE_PROVIDER_CARD_ID,
    canonicalIds: OPENAI_IMAGE_CANONICAL_IDS,
  },
  { presetId: GEMINI_PROVIDER_CARD_ID, canonicalIds: GEMINI_CANONICAL_IDS },
  {
    presetId: NANO_BANANA_PROVIDER_CARD_ID,
    canonicalIds: NANO_BANANA_CANONICAL_IDS,
  },
  { presetId: VEO_PROVIDER_CARD_ID, canonicalIds: VEO_CANONICAL_IDS },
  { presetId: GROK_PROVIDER_CARD_ID, canonicalIds: GROK_CANONICAL_IDS },
  {
    presetId: GROK_IMAGINE_IMAGE_PROVIDER_CARD_ID,
    canonicalIds: GROK_IMAGINE_IMAGE_CANONICAL_IDS,
  },
  {
    presetId: GROK_IMAGINE_VIDEO_PROVIDER_CARD_ID,
    canonicalIds: GROK_IMAGINE_VIDEO_CANONICAL_IDS,
  },
  { presetId: CLAUDE_PROVIDER_CARD_ID, canonicalIds: CLAUDE_CANONICAL_IDS },
  {
    presetId: MINIMAX_SPEECH_PROVIDER_CARD_ID,
    canonicalIds: MINIMAX_SPEECH_CANONICAL_IDS,
  },
] as const;

/** Default channel rows for migrations and tests. */
export function buildPlatformAiModelChannelSeed(): readonly PlatformAiModelChannel[] {
  const rows: PlatformAiModelChannel[] = [];

  for (const entry of VOLCANO_AGGREGATE_MODEL_CATALOG) {
    rows.push({
      canonicalId: entry.canonicalId,
      channel: "aggregate",
      presetId: VOLCANO_AGGREGATE_PRESET_ID,
      upstreamModelId: entry.providerModelId,
      channelEnabled: true,
    });
  }

  for (const brand of API_BRAND_CHANNELS) {
    for (const canonicalId of brand.canonicalIds) {
      rows.push({
        canonicalId,
        channel: "api",
        presetId: brand.presetId,
        upstreamModelId: defaultUpstreamModelIdForCanonical(canonicalId),
        channelEnabled: true,
      });
    }
  }

  return rows;
}

export const PLATFORM_AI_MODEL_CHANNEL_SEED =
  buildPlatformAiModelChannelSeed();
