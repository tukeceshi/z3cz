import type { MediaReference } from "@dafthunk/types";
import { getMediaReferenceKey } from "@dafthunk/types";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { CACHE_STATS_EVENT } from "@/services/ai-media-cache-events";
import { ingestCanvasMediaInBackground } from "@/services/ingest-canvas-media";
import {
  resolveCanvasTierUrlSet,
  resolveStableCanvasTierUrlSet,
} from "@/services/resolve-resource-display-url";

export function useReferenceThumbUrl(params: {
  readonly media: MediaReference | null;
  readonly nodeType?: "ai-image" | "ai-video";
}): string | null {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id ?? "";
  const mediaKey = useMemo(
    () => (params.media ? getMediaReferenceKey(params.media) : null),
    [params.media]
  );

  const [thumbUrl, setThumbUrl] = useState<string | null>(() => {
    if (!params.media || !orgId || !workflowId) {
      return null;
    }
    return (
      resolveStableCanvasTierUrlSet({
        media: params.media,
        organizationId: orgId,
        workflowId,
      })?.s ?? null
    );
  });
  const [cacheRevision, setCacheRevision] = useState(0);

  useEffect(() => {
    const handler = () => {
      setCacheRevision((value) => value + 1);
    };
    window.addEventListener(CACHE_STATS_EVENT, handler);
    return () => window.removeEventListener(CACHE_STATS_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!params.media || !orgId || !workflowId || !mediaKey) {
      setThumbUrl(null);
      return;
    }

    const stable = resolveStableCanvasTierUrlSet({
      media: params.media,
      organizationId: orgId,
      workflowId,
    });
    if (stable) {
      setThumbUrl(stable.s);
      return;
    }

    let cancelled = false;

    void resolveCanvasTierUrlSet({
      media: params.media,
      organizationId: orgId,
      workflowId,
    }).then((set) => {
      if (cancelled) {
        return;
      }
      if (set) {
        setThumbUrl(set.s);
        return;
      }

      if (params.nodeType) {
        ingestCanvasMediaInBackground({
          organizationId: orgId,
          workflowId,
          media: params.media!,
          nodeType: params.nodeType,
        });
      }
      setThumbUrl(null);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheRevision, mediaKey, orgId, params.media, params.nodeType, workflowId]);

  return thumbUrl;
}
