import {
  isWorkflowMediaValue,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import { useMemo } from "react";

import type { MediaDisplaySize } from "@/services/media-display-size";
import type { MediaDisplayUrlSet } from "@/services/ai-media-cache-service";
import {
  resolveMediaDisplay,
  type MediaDisplay,
  type MediaDisplayPhase,
} from "@/services/media-display-readiness";

import { useMediaDisplayUrlSet } from "./use-media-display-url-set";

export interface SharedMediaDisplayUrlSet {
  readonly urlSet: MediaDisplayUrlSet;
  readonly stale: boolean;
  readonly retry: () => void;
}

export function useMediaDisplayAtSize(params: {
  readonly media: WorkflowMediaValue | null;
  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";
  readonly size: MediaDisplaySize;
  readonly paused?: boolean;
  readonly sharedUrlSet?: SharedMediaDisplayUrlSet;
}): MediaDisplay & {
  readonly urlSet: MediaDisplayUrlSet;
  readonly stale: boolean;
  readonly retry: () => void;
} {
  const internal = useMediaDisplayUrlSet({
    media: params.sharedUrlSet ? null : params.media,
    nodeType: params.nodeType,
    paused: params.paused,
    preferredSize: params.size,
  });
  const urlSet = params.sharedUrlSet?.urlSet ?? internal.urlSet;
  const stale = params.sharedUrlSet?.stale ?? internal.stale;
  const retry = params.sharedUrlSet?.retry ?? internal.retry;

  const display = useMemo(
    () =>
      resolveMediaDisplay({
        media: params.media,
        urlSet,
        stale,
        size: params.size,
      }),
    [params.media, params.size, stale, urlSet]
  );

  return {
    ...display,
    urlSet,
    stale,
    retry,
  };
}

/** One fetch layer + full-size readiness for generative canvas cards. */
export function useGenerativeCardMediaDisplay(params: {
  readonly media: WorkflowMediaValue | null;
  readonly nodeType: "ai-image" | "ai-video";
}): {
  readonly sharedUrlSet: SharedMediaDisplayUrlSet;
  readonly fullDisplayUrl: string | null;
} {
  const { urlSet, stale, retry } = useMediaDisplayUrlSet({
    media: params.media,
    nodeType: params.nodeType,
  });
  const sharedUrlSet = useMemo(
    () => ({ urlSet, stale, retry }),
    [urlSet, stale, retry]
  );
  const fullDisplay = useMemo(
    () =>
      resolveMediaDisplay({
        media: params.media,
        urlSet,
        size: "full",
        stale,
      }),
    [params.media, stale, urlSet]
  );

  return {
    sharedUrlSet,
    fullDisplayUrl:
      fullDisplay.phase === "ready" ? fullDisplay.displayUrl : null,
  };
}

interface UseMediaDisplayUrlParams {
  readonly media: WorkflowMediaValue | null;
  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";
  readonly size?: MediaDisplaySize;
  readonly localOnly?: boolean;
  /** When true, skip async refresh but still apply cached/stable URLs. */
  readonly paused?: boolean;
}

export function useMediaDisplayUrl({
  media,
  nodeType,
  size = "full",
  localOnly: _localOnly = false,
  paused = false,
}: UseMediaDisplayUrlParams): {
  readonly displayUrl: string | null;
  readonly phase: MediaDisplayPhase;
  readonly stale: boolean;
  readonly retry: () => void;
} {
  const { urlSet, stale, retry } = useMediaDisplayUrlSet({
    media,
    nodeType,
    paused,
    preferredSize: size,
  });

  const display = useMemo(
    () =>
      resolveMediaDisplay({
        media,
        urlSet,
        size,
        stale,
      }),
    [media, size, stale, urlSet]
  );

  return {
    displayUrl: display.displayUrl,
    phase: display.phase,
    stale,
    retry,
  };
}

export function resolveMediaFromValue(
  value: WorkflowMediaValue | unknown
): WorkflowMediaValue | null {
  return isWorkflowMediaValue(value) ? value : null;
}

export function invalidateMediaDisplayUrlCacheKey(_cacheKey: string): void {
  // Stable blob URLs are keyed by media id; callers should use retry() on the hook.
}
