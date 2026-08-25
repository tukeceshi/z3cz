import {
  AI_AUDIO_CARD_HEIGHT_PX,
  AI_AUDIO_CARD_WIDTH_PX,
} from "@/components/workflow/ai-audio-node-utils";
import {
  AI_TEXT_CARD_HEIGHT_PX,
  AI_TEXT_CARD_WIDTH_PX,
} from "@/components/workflow/ai-text-node-utils";
import {
  AI_IMAGE_EMPTY_CARD_SIZE,
  AI_VIDEO_EMPTY_CARD_SIZE,
  computeMediaCardSize,
  type MediaCardSize,
} from "@/components/workflow/media-card-size";
import type { AiMediaCacheNodeType } from "@/services/ai-media-cache-service";

export function resolveStagingCardLayout(
  nodeType: AiMediaCacheNodeType,
  naturalSize?: { readonly width: number; readonly height: number } | null
): MediaCardSize {
  if (nodeType === "ai-text" || nodeType === "agent-chat") {
    return { width: AI_TEXT_CARD_WIDTH_PX, height: AI_TEXT_CARD_HEIGHT_PX };
  }
  if (nodeType === "ai-audio") {
    return { width: AI_AUDIO_CARD_WIDTH_PX, height: AI_AUDIO_CARD_HEIGHT_PX };
  }

  if (
    naturalSize &&
    naturalSize.width > 0 &&
    naturalSize.height > 0
  ) {
    return computeMediaCardSize(naturalSize.width, naturalSize.height);
  }

  return nodeType === "ai-video"
    ? AI_VIDEO_EMPTY_CARD_SIZE
    : AI_IMAGE_EMPTY_CARD_SIZE;
}
