import {
  getMediaReferenceKey,
  isEphemeralMediaReference,
  isObjectReference,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";

import { getApiBaseUrl } from "@/config/api";
import { getCachedMediaBlobUrl, cacheMediaFromUrl } from "@/services/ai-media-cache-service";
import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";
import type { MediaDisplaySize } from "@/services/media-display-size";

export function createCloudObjectUrl(
  ref: ObjectReference,
  organizationId: string
): string {
  if (ref.storageBackend === "volcengine_tos" && ref.storageKey) {
    const base = `${getApiBaseUrl()}/${organizationId}/objects/cloud`;
    return `${base}?storageKey=${encodeURIComponent(ref.storageKey)}&mimeType=${encodeURIComponent(ref.mimeType)}`;
  }

  const base = `${getApiBaseUrl()}/${organizationId}/objects`;
  return `${base}?id=${encodeURIComponent(ref.id)}&mimeType=${encodeURIComponent(ref.mimeType)}`;
}

export function resolveMediaFetchUrl(
  media: MediaReference,
  organizationId: string,
  createObjectUrl?: (ref: ObjectReference) => string
): string | null {
  if (isEphemeralMediaReference(media)) {
    return media.url;
  }
  if (isObjectReference(media)) {
    if (media.storageBackend === "volcengine_tos" && media.storageKey) {
      return createCloudObjectUrl(media, organizationId);
    }
    if (createObjectUrl) {
      return createObjectUrl(media);
    }
    return createCloudObjectUrl(media, organizationId);
  }
  return null;
}

export function inferMediaNodeType(
  media: MediaReference
): "ai-image" | "ai-video" | null {
  const mime = media.mimeType.toLowerCase();
  if (mime.startsWith("video/")) return "ai-video";
  if (mime.startsWith("image/")) return "ai-image";
  return null;
}

export async function resolveMediaDisplayUrl(params: {
  readonly media: MediaReference;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly workflowName?: string;
  readonly nodeType?: "ai-image" | "ai-video";
  readonly createObjectUrl?: (ref: ObjectReference) => string;
  readonly warmCache?: boolean;
  readonly size?: MediaDisplaySize;
}): Promise<string | null> {
  const mediaId = getMediaReferenceKey(params.media);
  const cached = await getCachedMediaBlobUrl({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId,
    size: params.size,
  });
  if (cached) return cached;

  const fetchUrl = resolveMediaFetchUrl(
    params.media,
    params.organizationId,
    params.createObjectUrl
  );
  if (!fetchUrl) return null;

  const shouldWarm = params.warmCache !== false;
  const nodeType =
    params.nodeType ?? inferMediaNodeType(params.media);

  if (shouldWarm && nodeType && !isMediaExpired(params.media)) {
    void cacheMediaFromUrl({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      workflowName: params.workflowName ?? params.workflowId,
      media: params.media,
      nodeType,
      fetchUrl,
    }).then((cachedOk) => {
      if (cachedOk) notifyAiMediaCacheChanged();
    });
  }

  return fetchUrl;
}

export function isMediaExpired(media: MediaReference): boolean {
  if (!isEphemeralMediaReference(media) || !media.expiresAt) return false;
  return Date.parse(media.expiresAt) <= Date.now();
}
