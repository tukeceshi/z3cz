import { getMediaReferenceKey, type MediaReference } from "@dafthunk/types";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { getCachedMediaNaturalSize } from "@/services/ai-media-cache-service";
import { CACHE_STATS_EVENT } from "@/services/ai-media-cache-events";

export function useCachedMediaNaturalSize(
  media: MediaReference | null | undefined
): { readonly width: number; readonly height: number } | null {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id ?? "";
  const mediaId = media ? getMediaReferenceKey(media) : null;
  const [naturalSize, setNaturalSize] = useState<{
    readonly width: number;
    readonly height: number;
  } | null>(null);

  useEffect(() => {
    if (!mediaId || !orgId || !workflowId) {
      setNaturalSize(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const size = await getCachedMediaNaturalSize({
        organizationId: orgId,
        workflowId,
        mediaId,
      });
      if (!cancelled) {
        setNaturalSize(size);
      }
    };

    void load();

    const handler = () => {
      void load();
    };
    window.addEventListener(CACHE_STATS_EVENT, handler);
    return () => {
      cancelled = true;
      window.removeEventListener(CACHE_STATS_EVENT, handler);
    };
  }, [mediaId, orgId, workflowId]);

  return naturalSize;
}
