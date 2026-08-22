import type { WorkflowMediaValue } from "@dafthunk/types";

import type { MediaDisplayUrlSet } from "@/services/ai-media-cache-service";
import { pickMediaDisplayUrl } from "@/services/resolve-resource-display-url";
import type { MediaDisplaySize } from "@/services/media-display-size";

export type MediaDisplayPhase = "empty" | "loading" | "ready" | "missing";

export interface MediaDisplayReadiness {
  readonly phase: MediaDisplayPhase;
  readonly displayUrl: string | null;
}

export function resolveMediaDisplayReadiness(params: {
  readonly media: WorkflowMediaValue | null;
  readonly urlSet: MediaDisplayUrlSet;
  readonly size: MediaDisplaySize;
  readonly stale: boolean;
}): MediaDisplayReadiness {
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

  return { phase: "missing", displayUrl: null };
}
