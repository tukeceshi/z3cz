import type { GenerativeCardError } from "@dafthunk/types";

import { generativeCardProgressKey } from "@/hooks/use-generative-cloud-job";

import { isAiImageGenerating } from "./ai-image-node-utils";
import { isAiVideoGenerating } from "./ai-video-node-utils";
import { readGenerativeCardError } from "./generative-card-error-utils";
import {
  isGenerativeProgressBusyPhase,
  readGenerativeProgressPhase,
  type GenerativeProgressPhase,
} from "./generative-progress-utils";

export type StudioMediaKind = "image" | "video";

export interface StudioMediaCardState {
  readonly placeholderKey: string;
  readonly isBusy: boolean;
  readonly generateError: GenerativeCardError | undefined;
}

function resolveProgressPhaseForPlaceholder(
  metadata: Record<string, string> | undefined,
  isVideo: boolean
): GenerativeProgressPhase | null {
  const progressPhase = readGenerativeProgressPhase(metadata);
  if (progressPhase !== undefined) {
    return progressPhase;
  }

  const isGenerating = isVideo
    ? isAiVideoGenerating(metadata)
    : isAiImageGenerating(metadata);
  return isGenerating ? "generating" : null;
}

function readStudioMediaIsBusy(
  metadata: Record<string, string> | undefined,
  isVideo: boolean
): boolean {
  const progressPhase = readGenerativeProgressPhase(metadata);
  if (isVideo) {
    return (
      isAiVideoGenerating(metadata) ||
      isGenerativeProgressBusyPhase(progressPhase)
    );
  }

  return isAiImageGenerating(metadata) || progressPhase !== undefined;
}

export function readStudioMediaCardState(
  metadata: Record<string, string> | undefined,
  isVideo: boolean
): StudioMediaCardState {
  const mediaKind: StudioMediaKind = isVideo ? "video" : "image";
  const phase = resolveProgressPhaseForPlaceholder(metadata, isVideo);

  return {
    placeholderKey: generativeCardProgressKey(phase, mediaKind),
    isBusy: readStudioMediaIsBusy(metadata, isVideo),
    generateError: readGenerativeCardError(metadata),
  };
}
