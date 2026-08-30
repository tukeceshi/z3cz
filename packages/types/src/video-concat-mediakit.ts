import type { WorkflowNodeContentPatch } from "./platform-ai-model";

export const VIDEO_CONCAT_JOB_KIND = "video_concat" as const;
export const VIDEO_CONCAT_MODEL_CANONICAL_ID =
  "volcano-mediakit-video-concat" as const;
export const VIDEO_CONCAT_MODEL_DISPLAY_NAME = "视频拼接" as const;

export interface SubmitVideoConcatRequest {
  readonly aiInterfaceId: string;
  readonly videoUrls: readonly string[];
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly clientRequestId?: string;
}

export interface SubmitVideoConcatResponse {
  readonly taskId: string;
  readonly jobId?: string;
  readonly resourceIds?: readonly string[];
  readonly aiInterfaceId: string;
  readonly workflowNodeContent?: WorkflowNodeContentPatch;
}

export function isSubmitVideoConcatUrlsValid(
  videoUrls: readonly string[]
): boolean {
  if (videoUrls.length < 1 || videoUrls.length > 100) {
    return false;
  }
  return videoUrls.every((url) => url.trim().length > 0);
}
