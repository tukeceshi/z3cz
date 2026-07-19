import {
  getMediaReferenceKey,
  isEphemeralMediaReference,
  isObjectReference,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";

import { getApiBaseUrl } from "@/config/api";
import { getCachedMediaBlobUrl } from "@/services/ai-media-cache-service";

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

export async function resolveMediaDisplayUrl(params: {
  readonly media: MediaReference;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly createObjectUrl?: (ref: ObjectReference) => string;
}): Promise<string | null> {
  const mediaId = getMediaReferenceKey(params.media);
  const cached = await getCachedMediaBlobUrl({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId,
  });
  if (cached) return cached;

  return resolveMediaFetchUrl(
    params.media,
    params.organizationId,
    params.createObjectUrl
  );
}

export function isMediaExpired(media: MediaReference): boolean {
  if (!isEphemeralMediaReference(media) || !media.expiresAt) return false;
  return Date.parse(media.expiresAt) <= Date.now();
}
