import type { WorkflowMediaValue } from "@dafthunk/types";

import {
  useMediaDisplayAtSize,
  type SharedMediaDisplayUrlSet,
} from "@/hooks/use-media-display-url";
import type { MediaDisplayPhase } from "@/services/media-display-readiness";

export function useReferenceThumbUrl(params: {
  readonly media: WorkflowMediaValue | null;
  readonly nodeType?: "ai-image" | "ai-video";
  readonly paused?: boolean;
  readonly sharedUrlSet?: SharedMediaDisplayUrlSet;
}): {
  readonly displayUrl: string | null;
  readonly phase: MediaDisplayPhase;
} {
  const display = useMediaDisplayAtSize({
    media: params.media,
    nodeType: params.nodeType,
    paused: params.paused,
    sharedUrlSet: params.sharedUrlSet,
    size: "thumb",
  });

  return {
    displayUrl: display.phase === "ready" ? display.displayUrl : null,
    phase: display.phase,
  };
}
