import { getResourceIdFromValue, type MediaReference } from "@dafthunk/types";

import { probeVideoUrlDurationSeconds } from "@/components/workflow/ai-text-node-utils";
import { readCachedMediaBlobByMediaId } from "@/services/ai-media-cache-service";
import { resolveResourceDisplayUrl } from "@/services/resolve-resource-display-url";

export async function resolveTrimSourceVideoUrl(params: {
  readonly media: MediaReference;
  readonly organizationId: string;
  readonly workflowId: string;
}): Promise<string | null> {
  const mediaId = getResourceIdFromValue(params.media);
  if (mediaId) {
    const cached = await readCachedMediaBlobByMediaId({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId,
    });
    if (cached?.blob) {
      return URL.createObjectURL(cached.blob);
    }
  }

  return resolveResourceDisplayUrl({
    media: params.media,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    nodeType: "ai-video",
    size: "full",
  });
}

export async function resolveTrimVideoDurationSec(params: {
  readonly videoUrl: string;
  readonly cardVideoDurationSec?: number | null;
}): Promise<number> {
  if (
    params.cardVideoDurationSec !== undefined &&
    params.cardVideoDurationSec !== null &&
    Number.isFinite(params.cardVideoDurationSec) &&
    params.cardVideoDurationSec > 0
  ) {
    return params.cardVideoDurationSec;
  }
  return probeVideoUrlDurationSeconds(params.videoUrl);
}

export function isWebCodecsVideoTrimSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    typeof window.VideoDecoder !== "undefined" &&
    typeof window.VideoEncoder !== "undefined"
  );
}

export function revokeTrimObjectUrl(url: string | null | undefined): void {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
