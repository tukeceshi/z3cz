import {
  getMediaReferenceKey,
  isMediaReference,
  type MediaReference,
} from "@dafthunk/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import type { MediaDisplaySize } from "@/services/media-display-size";
import {
  isMediaExpired,
  resolveMediaDisplayUrl,
} from "@/services/media-url-resolver";
import { CACHE_STATS_EVENT } from "@/services/ai-media-cache-events";

const mediaDisplayUrlCache = new Map<string, string>();

function revokeCachedDisplayUrls(): void {
  for (const url of mediaDisplayUrlCache.values()) {
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }
  mediaDisplayUrlCache.clear();
}

function createMediaDisplayUrlCacheKey(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaKey: string;
  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";
  readonly size: MediaDisplaySize;
}): string {
  return [
    params.organizationId,
    params.workflowId,
    params.mediaKey,
    params.nodeType ?? "",
    params.size,
  ].join("|");
}

interface UseMediaDisplayUrlParams {
  readonly media: MediaReference | null;
  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";
  readonly size?: MediaDisplaySize;
}

export function useMediaDisplayUrl({
  media,
  nodeType,
  size = "full",
}: UseMediaDisplayUrlParams): {
  readonly displayUrl: string | null;
  readonly stale: boolean;
} {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id ?? "";
  const mediaKey = useMemo(
    () => (media ? getMediaReferenceKey(media) : null),
    [media]
  );
  const cacheKey =
    mediaKey && orgId && workflowId
      ? createMediaDisplayUrlCacheKey({
          organizationId: orgId,
          workflowId,
          mediaKey,
          nodeType,
          size,
        })
      : null;
  const [displayUrl, setDisplayUrl] = useState<string | null>(() =>
    cacheKey ? mediaDisplayUrlCache.get(cacheKey) ?? null : null
  );
  const [stale, setStale] = useState(false);
  const [cacheRevision, setCacheRevision] = useState(0);
  const expired = media ? isMediaExpired(media) : false;
  const blobUrlRef = useRef<string | null>(cacheKey ? mediaDisplayUrlCache.get(cacheKey) ?? null : null);

  useEffect(() => {
    const handler = () => {
      revokeCachedDisplayUrls();
      setCacheRevision((value) => value + 1);
    };
    window.addEventListener(CACHE_STATS_EVENT, handler);
    return () => window.removeEventListener(CACHE_STATS_EVENT, handler);
  }, []);

  useEffect(() => {
    setStale(false);

    if (!media || !orgId || !workflowId || !mediaKey || !cacheKey) {
      setDisplayUrl(null);
      return;
    }

    if (expired) {
      mediaDisplayUrlCache.delete(cacheKey);
      setDisplayUrl(null);
      setStale(true);
      return;
    }

    const cached = mediaDisplayUrlCache.get(cacheKey);
    if (cached) {
      blobUrlRef.current = cached;
      setDisplayUrl(cached);
      return;
    }

    let cancelled = false;

    void resolveMediaDisplayUrl({
      media,
      organizationId: orgId,
      workflowId,
      nodeType,
      size,
    }).then((url) => {
      if (cancelled) {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
        return;
      }
      if (!url) {
        setDisplayUrl(null);
        setStale(true);
        return;
      }

      if (
        blobUrlRef.current?.startsWith("blob:") &&
        blobUrlRef.current !== url &&
        !mediaDisplayUrlCache.has(cacheKey)
      ) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      if (url.startsWith("blob:")) {
        blobUrlRef.current = url;
      } else {
        blobUrlRef.current = null;
      }
      mediaDisplayUrlCache.set(cacheKey, url);
      setDisplayUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [
    mediaKey,
    orgId,
    workflowId,
    nodeType,
    size,
    expired,
    cacheRevision,
    cacheKey,
  ]);

  useEffect(() => {
    return () => {
      if (
        blobUrlRef.current?.startsWith("blob:") &&
        (!cacheKey || mediaDisplayUrlCache.get(cacheKey) !== blobUrlRef.current)
      ) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [cacheKey]);

  return { displayUrl, stale };
}

export function resolveMediaFromValue(
  value: MediaReference | unknown
): MediaReference | null {
  return isMediaReference(value) ? value : null;
}
