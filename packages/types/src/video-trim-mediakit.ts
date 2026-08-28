import {
  snapVideoTrimSec,
  VIDEO_TRIM_MIN_DURATION_SEC,
  type VideoTrimRangeSec,
} from "./video-trim";

export const VIDEO_TRIM_JOB_KIND = "video_trim" as const;
export const VIDEO_TRIM_MODEL_CANONICAL_ID =
  "volcano-mediakit-video-trim" as const;
export const VIDEO_TRIM_MODEL_DISPLAY_NAME = "视频裁剪" as const;

export interface SubmitVideoTrimRequest {
  readonly aiInterfaceId: string;
  readonly sourceVideoResourceId: string;
  readonly startSec: number;
  readonly endSec: number;
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly clientRequestId?: string;
}

export interface SubmitVideoTrimResponse {
  readonly taskId: string;
  readonly jobId?: string;
  readonly resourceIds?: readonly string[];
  readonly aiInterfaceId: string;
  readonly workflowNodeContent?: unknown;
}

export function normalizeSubmitVideoTrimRange(params: {
  readonly startSec: number;
  readonly endSec: number;
}): VideoTrimRangeSec {
  return {
    startSec: snapVideoTrimSec(params.startSec),
    endSec: snapVideoTrimSec(params.endSec),
  };
}

export function isSubmitVideoTrimRangeValid(range: VideoTrimRangeSec): boolean {
  if (!Number.isFinite(range.startSec) || !Number.isFinite(range.endSec)) {
    return false;
  }
  if (range.startSec < 0) {
    return false;
  }
  return range.endSec - range.startSec >= VIDEO_TRIM_MIN_DURATION_SEC;
}

export function formatVideoTrimPromptExcerpt(range: VideoTrimRangeSec): string {
  return `${range.startSec.toFixed(1)}s – ${range.endSec.toFixed(1)}s`;
}
