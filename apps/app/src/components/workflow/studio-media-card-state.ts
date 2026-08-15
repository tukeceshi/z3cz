import type { GenerativeCardError } from "@dafthunk/types";
import { hasGeneratingResource } from "@dafthunk/types";

import { generativeCardProgressKey } from "@/hooks/use-generative-cloud-job";

import { isAiImageGenerating } from "./ai-image-node-utils";
import { isAiVideoGenerating } from "./ai-video-node-utils";
import { readGenerativeCardError } from "./generative-card-error-utils";
import {
  isGenerativePersistPhase,
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
  isVideo: boolean,
  media?: readonly unknown[]
): GenerativeProgressPhase | null {
  const progressPhase = readGenerativeProgressPhase(metadata);
  if (isGenerativePersistPhase(progressPhase)) {
    return progressPhase;
  }
  if (progressPhase !== undefined && progressPhase !== "generating") {
    return progressPhase;
  }

  if (!isVideo && hasGeneratingResource(media)) {
    return "generating";
  }

  const isGenerating = isVideo
    ? isAiVideoGenerating(metadata)
    : isAiImageGenerating(metadata);
  return isGenerating || progressPhase === "generating" ? "generating" : null;
}

function readStudioMediaIsBusy(
  metadata: Record<string, string> | undefined,
  isVideo: boolean,
  media?: readonly unknown[]
): boolean {
  const progressPhase = readGenerativeProgressPhase(metadata);
  if (isVideo) {
    return (
      isAiVideoGenerating(metadata) ||
      isGenerativeProgressBusyPhase(progressPhase)
    );
  }

  return (
    isAiImageGenerating(metadata) ||
    hasGeneratingResource(media) ||
    isGenerativePersistPhase(progressPhase) ||
    progressPhase === "cancelled"
  );
}

export function readStudioMediaCardState(
  metadata: Record<string, string> | undefined,
  isVideo: boolean,
  media?: readonly unknown[]
): StudioMediaCardState {
  const mediaKind: StudioMediaKind = isVideo ? "video" : "image";
  const phase = resolveProgressPhaseForPlaceholder(metadata, isVideo, media);

  return {
    placeholderKey: generativeCardProgressKey(phase, mediaKind),
    isBusy: readStudioMediaIsBusy(metadata, isVideo, media),
    generateError: readGenerativeCardError(metadata),
  };
}
