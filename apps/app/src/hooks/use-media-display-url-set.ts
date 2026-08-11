import {

  getResourceIdFromValue,

  type WorkflowMediaValue,

} from "@dafthunk/types";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useParams } from "react-router";



import { useAuth } from "@/components/auth-context";

import {

  EMPTY_MEDIA_DISPLAY_URL_SET,

  isMediaDisplayUrlSetEmpty,

  type MediaDisplayUrlSet,

} from "@/services/ai-media-cache-service";

import { CACHE_STATS_EVENT } from "@/services/ai-media-cache-events";

import { ingestCanvasMediaInBackground } from "@/services/ingest-canvas-media";

import { dropStableBlobUrlsForMediaId } from "@/services/media-display-blob-url-registry";

import { resetMediaIngestState } from "@/services/media-ingest-coordinator";

import {

  resolveMediaDisplayUrlSet,

  resolveStableMediaDisplayUrlSet,

} from "@/services/resolve-resource-display-url";



interface UseMediaDisplayUrlSetParams {

  readonly media: WorkflowMediaValue | null;

  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";

  readonly paused?: boolean;

}



export function useMediaDisplayUrlSet({

  media,

  nodeType,

  paused = false,

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



  const [urlSet, setUrlSet] = useState<MediaDisplayUrlSet>(() => {

    if (!media || !orgId || !workflowId) {

      return EMPTY_MEDIA_DISPLAY_URL_SET;

    }

    return resolveStableMediaDisplayUrlSet({

      media,

      organizationId: orgId,

      workflowId,

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

    if (!currentMedia || !orgId || !workflowId || !mediaKey) {

      setUrlSet(EMPTY_MEDIA_DISPLAY_URL_SET);

      return;

    }



    const stable = resolveStableMediaDisplayUrlSet({

      media: currentMedia,

      organizationId: orgId,

      workflowId,

    });

    if (!isMediaDisplayUrlSetEmpty(stable)) {

      setUrlSet(stable);

    }



    if (paused) {

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



      setUrlSet(resolved);



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

  }, [cacheRevision, mediaKey, nodeType, orgId, paused, workflowId]);



  const stale = Boolean(media && isMediaDisplayUrlSetEmpty(urlSet));



  return { urlSet, stale, retry };

}


