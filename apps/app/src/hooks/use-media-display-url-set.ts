import {
  getResourceIdFromValue,
  isUnloadedResourceRef,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import {
  EMPTY_MEDIA_DISPLAY_URL_SET,
  isMediaDisplayUrlSetEmpty,
  type MediaDisplayUrlSet,
} from "@/services/ai-media-cache-service";
import { CACHE_STATS_EVENT } from "@/services/ai-media-cache-events";
import { ingestCanvasMediaInBackground } from "@/services/ingest-canvas-media";
import { dropStableBlobUrlsForMediaId } from "@/services/media-display-blob-url-registry";
import {
  hasRememberedDisplayThumb,
  mediaDisplayUrlSetsEqual,
  recallMediaDisplayUrlSet,
  rememberMediaDisplayUrlSet,
} from "@/services/media-display-url-set-memory";
import { resetMediaIngestState } from "@/services/media-ingest-coordinator";
import {
  resolveMediaDisplayUrlSet,
  resolveStableMediaDisplayUrlSet,
} from "@/services/resolve-resource-display-url";

interface UseMediaDisplayUrlSetParams {
  readonly media: WorkflowMediaValue | null;
  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";
  readonly paused?: boolean;
}

function rememberIfNeeded(
  organizationId: string,
  workflowId: string,
  mediaId: string,
  urlSet: MediaDisplayUrlSet
): void {
  rememberMediaDisplayUrlSet({
    organizationId,
    workflowId,
    mediaId,
    urlSet,
  });
}

function readImmediateUrlSet(params: {
  readonly media: WorkflowMediaValue;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): MediaDisplayUrlSet {
  const stable = resolveStableMediaDisplayUrlSet(params);
  if (hasRememberedDisplayThumb(stable)) {
    rememberIfNeeded(
      params.organizationId,
      params.workflowId,
      params.mediaId,
      stable
    );
    return stable;
  }

  const recalled = recallMediaDisplayUrlSet({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId: params.mediaId,
  });
  if (recalled && hasRememberedDisplayThumb(recalled)) {
    return recalled;
  }

  return stable;
}

export function useMediaDisplayUrlSet({
  media,
  nodeType,
  paused = false,
}: UseMediaDisplayUrlSetParams): {
  readonly urlSet: MediaDisplayUrlSet;
  readonly stale: boolean;
  readonly retry: () => void;
} {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id ?? "";
  const mediaKey = useMemo(
    () => (media ? getResourceIdFromValue(media) : null),
    [media]
  );
  const mediaRef = useRef(media);
  mediaRef.current = media;

  const [urlSet, setUrlSet] = useState<MediaDisplayUrlSet>(() => {
    if (!media || isUnloadedResourceRef(media) || !orgId || !workflowId || !mediaKey) {
      return EMPTY_MEDIA_DISPLAY_URL_SET;
    }
    return readImmediateUrlSet({
      media,
      organizationId: orgId,
      workflowId,
      mediaId: mediaKey,
    });
  });
  const [cacheRevision, setCacheRevision] = useState(0);

  const retry = useCallback(() => {
    if (mediaKey && orgId && workflowId) {
      dropStableBlobUrlsForMediaId(mediaKey);
      resetMediaIngestState({
        organizationId: orgId,
        workflowId,
        mediaId: mediaKey,
      });
    }
    setUrlSet(EMPTY_MEDIA_DISPLAY_URL_SET);
    setCacheRevision((value) => value + 1);
  }, [mediaKey, orgId, workflowId]);

  useEffect(() => {
    const handler = () => {
      setCacheRevision((value) => value + 1);
    };
    window.addEventListener(CACHE_STATS_EVENT, handler);
    return () => window.removeEventListener(CACHE_STATS_EVENT, handler);
  }, []);

  useEffect(() => {
    const currentMedia = mediaRef.current;
    if (
      !currentMedia ||
      isUnloadedResourceRef(currentMedia) ||
      !orgId ||
      !workflowId ||
      !mediaKey
    ) {
      setUrlSet(EMPTY_MEDIA_DISPLAY_URL_SET);
      return;
    }

    const immediate = readImmediateUrlSet({
      media: currentMedia,
      organizationId: orgId,
      workflowId,
      mediaId: mediaKey,
    });
    setUrlSet((prev) =>
      mediaDisplayUrlSetsEqual(prev, immediate) ? prev : immediate
    );

    if (paused) {
      return;
    }

    const skipAsync =
      cacheRevision === 0 && hasRememberedDisplayThumb(immediate);
    if (skipAsync) {
      return;
    }

    let cancelled = false;

    void resolveMediaDisplayUrlSet({
      media: currentMedia,
      organizationId: orgId,
      workflowId,
      nodeType,
    }).then((resolved) => {
      if (cancelled) {
        return;
      }

      if (hasRememberedDisplayThumb(resolved)) {
        rememberIfNeeded(orgId, workflowId, mediaKey, resolved);
      }

      setUrlSet((prev) =>
        mediaDisplayUrlSetsEqual(prev, resolved) ? prev : resolved
      );

      if (isMediaDisplayUrlSetEmpty(resolved) && nodeType) {
        ingestCanvasMediaInBackground({
          organizationId: orgId,
          workflowId,
          media: currentMedia,
          nodeType,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cacheRevision, mediaKey, nodeType, orgId, paused, workflowId]);

  const stale = Boolean(media && isMediaDisplayUrlSetEmpty(urlSet));

  return { urlSet, stale, retry };
}
