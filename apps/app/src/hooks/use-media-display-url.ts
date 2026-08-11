import {
  isWorkflowMediaValue,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import { useMemo } from "react";

import type { MediaDisplaySize } from "@/services/media-display-size";
import { pickMediaDisplayUrl } from "@/services/resolve-resource-display-url";

import { useMediaDisplayUrlSet } from "./use-media-display-url-set";

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
  readonly stale: boolean;
  readonly retry: () => void;
} {
  const { urlSet, stale, retry } = useMediaDisplayUrlSet({
    media,
    nodeType,
    paused,
  });

  const displayUrl = useMemo(() => {
    if (!media) {
      return null;
    }
    return pickMediaDisplayUrl(urlSet, size);
  }, [media, size, urlSet]);

  return { displayUrl, stale, retry };
}

export function resolveMediaFromValue(
  value: WorkflowMediaValue | unknown
): WorkflowMediaValue | null {
  return isWorkflowMediaValue(value) ? value : null;
}

export function invalidateMediaDisplayUrlCacheKey(_cacheKey: string): void {
  // Stable blob URLs are keyed by media id; callers should use retry() on the hook.
}
