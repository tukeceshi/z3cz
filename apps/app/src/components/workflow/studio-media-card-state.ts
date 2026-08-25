import type { GenerativeCardError } from "@dafthunk/types";
import { hasGeneratingResource } from "@dafthunk/types";

import { generativeCardProgressKey } from "@/hooks/use-generative-cloud-job";

import { isAiImageGenerating } from "./ai-image-node-utils";
import { isAiVideoGenerating } from "./ai-video-node-utils";
import { readGenerativeCardError } from "./generative-card-error-utils";
import {
  resolveGenerativeCardPhase,
} from "./generative-history-utils";
import {
  formatGenerativePhaseLabel,
  isGenerativeCardBusyPhase,
  type GenerativeProgressPhase,
} from "./generative-progress-utils";

export type StudioMediaKind = "image" | "video";

export interface StudioMediaCardState {
  readonly placeholderKey: string;
  readonly phase: GenerativeProgressPhase | null;
  readonly isBusy: boolean;
  readonly generateError: GenerativeCardError | undefined;
}

export function readStudioMediaCardState(
  metadata: Record<string, string> | undefined,
  isVideo: boolean,
  media?: readonly unknown[]
): StudioMediaCardState {
  const mediaKind: StudioMediaKind = isVideo ? "video" : "image";
  const isModalityGenerating = isVideo
    ? isAiVideoGenerating(metadata)
    : isAiImageGenerating(metadata);
  const phase = resolveGenerativeCardPhase(metadata, media, isModalityGenerating);

  return {
    placeholderKey: generativeCardProgressKey(phase, mediaKind),
    phase,
    isBusy:
      (phase !== null && isGenerativeCardBusyPhase(phase)) ||
      isModalityGenerating ||
      hasGeneratingResource(media),
    generateError: readGenerativeCardError(metadata),
  };
}

export function formatStudioMediaCardPlaceholder(params: {
  readonly cardState: StudioMediaCardState;
  readonly metadata: Record<string, string> | undefined;
  readonly t: (
    key: string,
    values?: Record<string, string | number>
  ) => string;
}): string {
  return formatGenerativePhaseLabel({
    phase: params.cardState.phase,
    progressKey: params.cardState.placeholderKey,
    metadata: params.metadata,
    t: params.t,
  });
}
