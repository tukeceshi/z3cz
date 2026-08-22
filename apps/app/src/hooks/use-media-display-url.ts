import {
  isWorkflowMediaValue,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import { useMemo } from "react";

import type { MediaDisplaySize } from "@/services/media-display-size";
import type { MediaDisplayUrlSet } from "@/services/ai-media-cache-service";
import {
  resolveMediaDisplayReadiness,
  type MediaDisplayPhase,
} from "@/services/media-display-readiness";

import { useMediaDisplayUrlSet } from "./use-media-display-url-set";

export interface SharedMediaDisplayUrlSet {
  readonly urlSet: MediaDisplayUrlSet;
  readonly stale: boolean;
  readonly retry: () => void;
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
  const fullReadiness = useMemo(
    () =>
      resolveMediaDisplayReadiness({
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
      fullReadiness.phase === "ready" ? fullReadiness.displayUrl : null,
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
  });

  const readiness = useMemo(
    () =>
      resolveMediaDisplayReadiness({
        media,
        urlSet,
        size,
        stale,
      }),
    [media, size, stale, urlSet]
  );

  return {
    displayUrl: readiness.displayUrl,
    phase: readiness.phase,
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
