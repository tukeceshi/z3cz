import {
  createDefaultVideoRetakeTrimRange,
  type VideoTrimRangeSec,
} from "./video-trim";

export const AI_VIDEO_RETAKE_DRAFT_INPUT_ID = "retake_draft" as const;

export type AiVideoRetakeLoadPhase = "loading" | "ready" | "error";

export type AiVideoRetakeCardPreview = "generated" | "source";

export interface AiVideoRetakeDraft {
  readonly videoDurationSec: number | null;
  readonly sourceVideoWidth: number | null;
  readonly sourceVideoHeight: number | null;
  readonly committedRange: VideoTrimRangeSec;
  readonly draftRange: VideoTrimRangeSec;
  readonly loadPhase: AiVideoRetakeLoadPhase;
  readonly highQuality: boolean;
  readonly playbackPaused: boolean;
  readonly cardPreview: AiVideoRetakeCardPreview;
  readonly primaryVideoEdgeId: string | null;
  readonly primaryVideoMediaKey: string | null;
  readonly selectedModelOptionId: string | null;
  readonly generationParams: Readonly<Record<string, unknown>>;
  readonly resolutionManuallySet: boolean;
}

export function createDefaultAiVideoRetakeDraft(
  videoDurationSec = 0
): AiVideoRetakeDraft {
  const defaultRange = createDefaultVideoRetakeTrimRange(videoDurationSec);
  return {
    videoDurationSec: videoDurationSec > 0 ? videoDurationSec : null,
    sourceVideoWidth: null,
    sourceVideoHeight: null,
    committedRange: defaultRange,
    draftRange: defaultRange,
    loadPhase: "loading",
    highQuality: false,
    playbackPaused: false,
    cardPreview: "source",
    primaryVideoEdgeId: null,
    primaryVideoMediaKey: null,
    selectedModelOptionId: null,
    generationParams: {},
    resolutionManuallySet: false,
  };
}

function isVideoTrimRangeSec(value: unknown): value is VideoTrimRangeSec {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as VideoTrimRangeSec;
  return (
    typeof record.startSec === "number" &&
    typeof record.endSec === "number" &&
    Number.isFinite(record.startSec) &&
    Number.isFinite(record.endSec)
  );
}

export function parseAiVideoRetakeDraft(raw: unknown): AiVideoRetakeDraft | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Partial<AiVideoRetakeDraft>;
  if (
    !isVideoTrimRangeSec(record.committedRange) ||
    !isVideoTrimRangeSec(record.draftRange)
  ) {
    return null;
  }
  const loadPhase =
    record.loadPhase === "ready" ||
    record.loadPhase === "error" ||
    record.loadPhase === "loading"
      ? record.loadPhase
      : "loading";
  return {
    videoDurationSec:
      typeof record.videoDurationSec === "number" ? record.videoDurationSec : null,
    sourceVideoWidth:
      typeof record.sourceVideoWidth === "number" ? record.sourceVideoWidth : null,
    sourceVideoHeight:
      typeof record.sourceVideoHeight === "number"
        ? record.sourceVideoHeight
        : null,
    committedRange: record.committedRange,
    draftRange: record.draftRange,
    loadPhase,
    highQuality: record.highQuality === true,
    playbackPaused: record.playbackPaused === true,
    cardPreview:
      record.cardPreview === "generated" || record.cardPreview === "source"
        ? record.cardPreview
        : "source",
    primaryVideoEdgeId:
      typeof record.primaryVideoEdgeId === "string"
        ? record.primaryVideoEdgeId
        : null,
    primaryVideoMediaKey:
      typeof record.primaryVideoMediaKey === "string"
        ? record.primaryVideoMediaKey
        : null,
    selectedModelOptionId:
      typeof record.selectedModelOptionId === "string"
        ? record.selectedModelOptionId
        : null,
    generationParams:
      record.generationParams &&
      typeof record.generationParams === "object" &&
      !Array.isArray(record.generationParams)
        ? record.generationParams
        : {},
    resolutionManuallySet: record.resolutionManuallySet === true,
  };
}

export function readAiVideoRetakeDraftFromInputs(
  inputs: readonly { readonly id: string; readonly value?: unknown }[]
): AiVideoRetakeDraft {
  const raw = inputs.find((input) => input.id === AI_VIDEO_RETAKE_DRAFT_INPUT_ID)
    ?.value;
  return parseAiVideoRetakeDraft(raw) ?? createDefaultAiVideoRetakeDraft();
}
