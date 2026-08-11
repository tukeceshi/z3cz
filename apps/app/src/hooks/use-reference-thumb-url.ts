import type { WorkflowMediaValue } from "@dafthunk/types";
import { useMemo } from "react";

import { useMediaDisplayUrlSet } from "@/hooks/use-media-display-url-set";

export function useReferenceThumbUrl(params: {
  readonly media: WorkflowMediaValue | null;
  readonly nodeType?: "ai-image" | "ai-video";
}): string | null {
  const { urlSet } = useMediaDisplayUrlSet({
    media: params.media,
    nodeType: params.nodeType,
  });

  return useMemo(() => {
    if (!params.media) {
      return null;
    }
    return urlSet.s ?? urlSet.full;
  }, [params.media, urlSet.full, urlSet.s]);
}
