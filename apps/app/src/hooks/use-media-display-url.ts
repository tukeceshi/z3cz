import {
  getMediaReferenceKey,
  isMediaReference,
  type MediaReference,
} from "@dafthunk/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import type { MediaDisplaySize } from "@/services/media-display-size";
import { isCanvasDisplaySize } from "@/services/media-display-size";
import {
  isMediaExpired,
  resolveMediaDisplayUrl,
} from "@/services/media-url-resolver";
import { resolveResourceDisplayUrl, resolveStableResourceDisplayUrl } from "@/services/resolve-resource-display-url";
import { CACHE_STATS_EVENT } from "@/services/ai-media-cache-events";
import { dropStableBlobUrlsForMediaId } from "@/services/media-display-blob-url-registry";

const mediaDisplayUrlCache = new Map<string, string>();

export function invalidateMediaDisplayUrlCacheKey(cacheKey: string): void {
  mediaDisplayUrlCache.delete(cacheKey);
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
  readonly localOnly?: boolean;
  /** When true, skip async refresh but still apply cached/stable URLs (e.g. viewport moving). */
  readonly paused?: boolean;
}

export function useMediaDisplayUrl({
  media,
  nodeType,
  size = "full",
  localOnly = false,
  paused = false,
}: UseMediaDisplayUrlParams): {
  readonly displayUrl: string | null;
  readonly stale: boolean;
  readonly retry: () => void;
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
  const [displayUrl, setDisplayUrl] = useState<string | null>(() => {
    if (!cacheKey || !mediaKey || !orgId || !workflowId) {
      return null;
    }

    const cached = mediaDisplayUrlCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (localOnly || isCanvasDisplaySize(size)) {
      if (!media) {
        return null;
      }
      return (
        resolveStableResourceDisplayUrl({
          media,
          organizationId: orgId,
          workflowId,
          size,
        }) ?? null
      );
    }

    return null;
  });
  const [stale, setStale] = useState(false);
  const [cacheRevision, setCacheRevision] = useState(0);
  const displayUrlRef = useRef(displayUrl);
  displayUrlRef.current = displayUrl;

  const expired =
    media && !localOnly && !isCanvasDisplaySize(size)
      ? isMediaExpired(media)
      : false;

  const retry = useCallback(() => {
    if (mediaKey) {
      dropStableBlobUrlsForMediaId(mediaKey);
    }
    if (cacheKey) {
      invalidateMediaDisplayUrlCacheKey(cacheKey);
    }
    setStale(false);
    setCacheRevision((value) => value + 1);
  }, [cacheKey, mediaKey]);

  useEffect(() => {
    const handler = () => {
      mediaDisplayUrlCache.clear();
      setCacheRevision((value) => value + 1);
    };
    window.addEventListener(CACHE_STATS_EVENT, handler);
    return () => window.removeEventListener(CACHE_STATS_EVENT, handler);
  }, []);

  useEffect(() => {
    setStale(false);

    if (!media || !orgId || !workflowId || !mediaKey || !cacheKey) {
      if (!displayUrlRef.current) {
        setDisplayUrl(null);
      }
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
      setDisplayUrl(cached);
      if (paused) {
        return;
      }
      return;
    }

    if (localOnly || isCanvasDisplaySize(size)) {
      const stable = resolveStableResourceDisplayUrl({
        media,
        organizationId: orgId,
        workflowId,
        size,
      });
      if (stable) {
        mediaDisplayUrlCache.set(cacheKey, stable);
        setDisplayUrl(stable);
        if (paused) {
          return;
        }
        return;
      }
    }

    if (paused) {
      return;
    }

    let cancelled = false;

    const resolver =
      localOnly || isCanvasDisplaySize(size)
        ? resolveResourceDisplayUrl
        : resolveMediaDisplayUrl;

    void resolver({
      media,
      organizationId: orgId,
      workflowId,
      nodeType,
      size,
    }).then((url) => {
      if (cancelled) {
        return;
      }
      if (!url) {
        if (!displayUrlRef.current) {
          setDisplayUrl(null);
          setStale(true);
        }
        return;
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
    localOnly,
    cacheKey,
    paused,
    media,
  ]);

  return { displayUrl, stale, retry };
}

export function resolveMediaFromValue(
  value: MediaReference | unknown
): MediaReference | null {
  return isMediaReference(value) ? value : null;
}
