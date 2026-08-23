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
  hasDisplayUrlForSize,
  isMediaDisplayUrlSetEmpty,
  type MediaDisplayUrlSet,
} from "@/services/ai-media-cache-service";
import { CACHE_STATS_EVENT } from "@/services/ai-media-cache-events";
import { ingestCanvasMediaInBackground } from "@/services/ingest-canvas-media";
import { dropStableBlobUrlsForMediaId } from "@/services/media-display-blob-url-registry";
import type { MediaDisplaySize } from "@/services/media-display-size";
import {
  getWorkflowMediaUrlSet,
  mediaDisplayUrlSetsEqual,
  patchWorkflowMediaUrlSet,
} from "@/services/workflow-media-address-catalog";
import { resetMediaIngestState } from "@/services/media-ingest-coordinator";
import {
  resolveMediaDisplayUrlSet,
  resolveStableMediaDisplayUrlSet,
} from "@/services/resolve-resource-display-url";

const DEFAULT_PREFERRED_SIZE: MediaDisplaySize = "canvas-s";

interface UseMediaDisplayUrlSetParams {
  readonly media: WorkflowMediaValue | null;
  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";
  readonly paused?: boolean;
  readonly preferredSize?: MediaDisplaySize;
}

function rememberIfNeeded(
  organizationId: string,
  workflowId: string,
  mediaId: string,
  urlSet: MediaDisplayUrlSet,
  preferredSize: MediaDisplaySize
): void {
  if (!hasDisplayUrlForSize(urlSet, preferredSize)) {
    return;
  }
  patchWorkflowMediaUrlSet({
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
  readonly preferredSize: MediaDisplaySize;
}): MediaDisplayUrlSet {
  const stable = resolveStableMediaDisplayUrlSet(params);
  if (hasDisplayUrlForSize(stable, params.preferredSize)) {
    rememberIfNeeded(
      params.organizationId,
      params.workflowId,
      params.mediaId,
      stable,
      params.preferredSize
    );
    return stable;
  }

  const recalled = getWorkflowMediaUrlSet(
    {
      organizationId: params.organizationId,
      workflowId: params.workflowId,
    },
    params.mediaId
  );
  if (hasDisplayUrlForSize(recalled, params.preferredSize)) {
    return recalled;
  }

  return stable;
}

export function useMediaDisplayUrlSet({
  media,
  nodeType,
  paused = false,
  preferredSize = DEFAULT_PREFERRED_SIZE,
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
  const preferredSizeRef = useRef(preferredSize);
  preferredSizeRef.current = preferredSize;

  const [urlSet, setUrlSet] = useState<MediaDisplayUrlSet>(() => {
    if (!media || isUnloadedResourceRef(media) || !orgId || !workflowId || !mediaKey) {
      return EMPTY_MEDIA_DISPLAY_URL_SET;
    }
    return readImmediateUrlSet({
      media,
      organizationId: orgId,
      workflowId,
      mediaId: mediaKey,
      preferredSize,
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
    const currentPreferredSize = preferredSizeRef.current;
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
      preferredSize: currentPreferredSize,
    });
    setUrlSet((prev) =>
      mediaDisplayUrlSetsEqual(prev, immediate) ? prev : immediate
    );

    if (paused) {
      return;
    }

    const skipAsync =
      cacheRevision === 0 && hasDisplayUrlForSize(immediate, currentPreferredSize);
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

      if (hasDisplayUrlForSize(resolved, currentPreferredSize)) {
        rememberIfNeeded(
          orgId,
          workflowId,
          mediaKey,
          resolved,
          currentPreferredSize
        );
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
  }, [cacheRevision, mediaKey, nodeType, orgId, paused, preferredSize, workflowId]);

  const stale = Boolean(media && isMediaDisplayUrlSetEmpty(urlSet));

  return { urlSet, stale, retry };
}
