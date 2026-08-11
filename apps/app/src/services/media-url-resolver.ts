import {
  getMediaReferenceKey,
  isEphemeralMediaReference,
  isLocalMediaReference,
  type MediaReference,
  type WorkflowMediaValue,
  workflowMediaMimeType as readWorkflowMediaMimeType,
} from "@dafthunk/types";

import { getCachedMediaBlobUrl, cacheMediaFromUrl } from "@/services/ai-media-cache-service";
import { mediaUrlSupportsBrowserCache } from "@/services/media-cache-fetch-utils";
import { readGenerativeStagingBlob } from "@/services/generative-media-staging";
import {
  createStableBlobUrl,
  findStableBlobUrlForMediaId,
  stagingBlobUrlKey,
} from "@/services/media-display-blob-url-registry";
import {
  createCloudObjectUrl,
  resolveMediaCacheFetchUrl,
  resolveMediaFetchUrl,
} from "@/services/media-object-url";
import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";
import type { MediaDisplaySize } from "@/services/media-display-size";

export {
  createCloudObjectUrl,
  resolveMediaCacheFetchUrl,
  resolveMediaFetchUrl,
} from "@/services/media-object-url";
export { mediaUrlSupportsBrowserCache } from "@/services/media-cache-fetch-utils";

export function inferMediaNodeType(
  media: WorkflowMediaValue
): "ai-image" | "ai-video" | "ai-audio" | null {
  const mime = (readWorkflowMediaMimeType(media) ?? "").toLowerCase();
  if (mime.startsWith("video/")) return "ai-video";
  if (mime.startsWith("audio/")) return "ai-audio";
  if (mime.startsWith("image/")) return "ai-image";
  return null;
}

export async function resolveMediaDisplayUrl(params: {
  readonly media: MediaReference;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName?: string;
  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";
  readonly warmCache?: boolean;
  readonly size?: MediaDisplaySize;
}): Promise<string | null> {
  if (isLocalMediaReference(params.media)) {
    const cached = await getCachedMediaBlobUrl({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId: params.media.mediaId,
      size: params.size,
    });
    if (cached) return cached;

    const existing = findStableBlobUrlForMediaId(params.media.mediaId);
    if (existing) return existing;

    const entry = await readGenerativeStagingBlob({
      mediaId: params.media.mediaId,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
    });
    if (!entry) return null;

    return createStableBlobUrl(
      stagingBlobUrlKey({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        mediaId: params.media.mediaId,
      }),
      entry.blob
    );
  }

  const mediaId = getMediaReferenceKey(params.media);

  const cached = await getCachedMediaBlobUrl({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId,
    size: params.size,
  });
  if (cached) return cached;

  const fetchUrl = resolveMediaFetchUrl(params.media, params.organizationId);
  if (!fetchUrl) return null;

  const shouldWarm = params.warmCache !== false;
  const nodeType =
    params.nodeType ?? inferMediaNodeType(params.media);

  if (shouldWarm && nodeType && !isMediaExpired(params.media)) {
    const cacheFetchUrl = resolveMediaCacheFetchUrl(
      params.media,
      params.organizationId
    );
    if (cacheFetchUrl && mediaUrlSupportsBrowserCache(cacheFetchUrl)) {
      void cacheMediaFromUrl({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        workflowName: params.workflowName ?? params.workflowId,
        media: params.media,
        nodeType,
        fetchUrl: cacheFetchUrl,
      }).then((cachedOk) => {
        if (cachedOk) notifyAiMediaCacheChanged();
      });
    }
  }

  return fetchUrl;
}

export function isMediaExpired(media: MediaReference): boolean {
  if (!isEphemeralMediaReference(media) || !media.expiresAt) return false;
  return Date.parse(media.expiresAt) <= Date.now();
}
