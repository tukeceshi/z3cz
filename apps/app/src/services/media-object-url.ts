import {
  isEphemeralMediaReference,
  isLocalMediaReference,
  isObjectReference,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";

import { buildApiUrl } from "@/config/api";

import { getCachedLocalMediaPreviewUrl } from "./local-media-staging";

export function createCloudObjectUrl(
  ref: ObjectReference,
  organizationId: string
): string {
  if (ref.storageBackend === "volcengine_tos" && ref.storageKey) {
    const base = buildApiUrl(`/${organizationId}/objects/cloud`);
    return `${base}?storageKey=${encodeURIComponent(ref.storageKey)}&mimeType=${encodeURIComponent(ref.mimeType)}`;
  }

  const base = buildApiUrl(`/${organizationId}/objects`);
  return `${base}?id=${encodeURIComponent(ref.id)}&mimeType=${encodeURIComponent(ref.mimeType)}`;
}

/** Playback / inline display URL (ephemeral keeps upstream URL for <video src>). */
export function resolveMediaFetchUrl(
  media: MediaReference,
  organizationId: string
): string | null {
  if (isEphemeralMediaReference(media)) {
    return media.url;
  }
  if (isLocalMediaReference(media)) {
    return getCachedLocalMediaPreviewUrl(media.mediaId);
  }
  if (isObjectReference(media)) {
    return createCloudObjectUrl(media, organizationId);
  }
  return null;
}

/** Same-origin URL for IndexedDB cache writes (matches image generate path). */
export function resolveMediaCacheFetchUrl(
  media: MediaReference,
  organizationId: string
): string | null {
  if (isLocalMediaReference(media)) {
    return null;
  }
  if (isObjectReference(media)) {
    return createCloudObjectUrl(media, organizationId);
  }
  if (isEphemeralMediaReference(media)) {
    const query = new URLSearchParams({
      url: media.url,
      mimeType: media.mimeType,
    });
    return buildApiUrl(
      `/${organizationId}/platform-ai/media/proxy?${query.toString()}`
    );
  }
  return null;
}
