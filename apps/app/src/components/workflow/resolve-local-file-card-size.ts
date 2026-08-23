import {
  AI_AUDIO_CARD_HEIGHT_PX,
  AI_AUDIO_CARD_WIDTH_PX,
} from "./ai-audio-node-utils";
import {
  AI_IMAGE_EMPTY_CARD_SIZE,
  AI_VIDEO_EMPTY_CARD_SIZE,
  computeMediaCardSize,
  type MediaCardSize,
} from "./media-card-size";
import type { GenerativeStudioDropKind } from "./generative-card-upload-utils";
import { readImageNaturalSize } from "@/services/generate-image-thumbnail";
import { readVideoNaturalSize } from "@/services/read-video-natural-size";

export function resolveEmptyCanvasDropCardSize(
  kind: GenerativeStudioDropKind
): MediaCardSize {
  if (kind === "video") {
    return AI_VIDEO_EMPTY_CARD_SIZE;
  }
  if (kind === "audio") {
    return {
      width: AI_AUDIO_CARD_WIDTH_PX,
      height: AI_AUDIO_CARD_HEIGHT_PX,
    };
  }
  return AI_IMAGE_EMPTY_CARD_SIZE;
}

export async function probeLocalFileCardSize(
  file: File,
  kind: GenerativeStudioDropKind
): Promise<MediaCardSize> {
  if (kind === "audio") {
    return resolveEmptyCanvasDropCardSize("audio");
  }

  if (kind === "image") {
    const natural = await readImageNaturalSize(file, file.type);
    if (natural && natural.width > 0 && natural.height > 0) {
      return computeMediaCardSize(natural.width, natural.height);
    }
    return AI_IMAGE_EMPTY_CARD_SIZE;
  }

  const natural = await readVideoNaturalSize(file);
  if (natural && natural.width > 0 && natural.height > 0) {
    return computeMediaCardSize(natural.width, natural.height);
  }
  return AI_VIDEO_EMPTY_CARD_SIZE;
}
