import type { WorkflowMediaValue } from "@dafthunk/types";

import type { MediaDisplayUrlSet } from "@/services/ai-media-cache-service";
import {
  isMediaDisplayTierPending,
  pickMediaDisplayUrl,
} from "@/services/ai-media-cache-service";
import type { MediaDisplaySize } from "@/services/media-display-size";

export type MediaDisplayPhase = "empty" | "loading" | "ready" | "missing";

export interface MediaDisplay {
  readonly phase: MediaDisplayPhase;
  readonly displayUrl: string | null;
}

/** Single-resource display: strict tier pick + loading/missing phases. */
export function resolveMediaDisplay(params: {
  readonly media: WorkflowMediaValue | null;
  readonly urlSet: MediaDisplayUrlSet;
  readonly stale: boolean;
  readonly size: MediaDisplaySize;
}): MediaDisplay {
  if (!params.media) {
    return { phase: "empty", displayUrl: null };
  }

  if (params.stale) {
    return { phase: "loading", displayUrl: null };
  }

  const displayUrl = pickMediaDisplayUrl(params.urlSet, params.size);
  if (displayUrl) {
    return { phase: "ready", displayUrl };
  }

  if (isMediaDisplayTierPending(params.urlSet, params.size)) {
    return { phase: "loading", displayUrl: null };
  }

  return { phase: "missing", displayUrl: null };
}

/** @deprecated Use {@link resolveMediaDisplay}. */
export type MediaDisplayReadiness = MediaDisplay;

/** @deprecated Use {@link resolveMediaDisplay}. */
export function resolveMediaDisplayReadiness(params: {
  readonly media: WorkflowMediaValue | null;
  readonly urlSet: MediaDisplayUrlSet;
  readonly size: MediaDisplaySize;
  readonly stale: boolean;
}): MediaDisplay {
  return resolveMediaDisplay(params);
}
