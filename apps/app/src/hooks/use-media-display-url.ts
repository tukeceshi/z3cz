import {
  getMediaReferenceKey,
  isMediaReference,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import type { MediaDisplaySize } from "@/services/media-display-size";
import {
  isMediaExpired,
  resolveMediaDisplayUrl,
} from "@/services/media-url-resolver";

interface UseMediaDisplayUrlParams {
  readonly media: MediaReference | null;
  readonly createObjectUrl?: (ref: ObjectReference) => string;
  readonly nodeType?: "ai-image" | "ai-video";
  readonly size?: MediaDisplaySize;
}

export function useMediaDisplayUrl({
  media,
  createObjectUrl,
  nodeType,
  size = "full",
}: UseMediaDisplayUrlParams): {
  readonly displayUrl: string | null;
  readonly stale: boolean;
} {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id ?? "";
  const mediaKey = useMemo(
    () => (media ? getMediaReferenceKey(media) : null),
    [media]
  );
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const expired = media ? isMediaExpired(media) : false;
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setStale(false);

    if (!media || !orgId || !workflowId || !mediaKey) {
      setDisplayUrl(null);
      return;
    }

    if (expired) {
      setDisplayUrl(null);
      setStale(true);
      return;
    }

    let cancelled = false;

    void resolveMediaDisplayUrl({
      media,
      organizationId: orgId,
      workflowId,
      createObjectUrl,
      nodeType,
      size,
    }).then((url) => {
      if (cancelled) {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
        return;
      }
      if (!url) {
        setDisplayUrl(null);
        setStale(true);
        return;
      }

      if (blobUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      if (url.startsWith("blob:")) {
        blobUrlRef.current = url;
      } else {
        blobUrlRef.current = null;
      }
      setDisplayUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [mediaKey, orgId, workflowId, createObjectUrl, nodeType, size, expired]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  return { displayUrl, stale };
}

export function resolveMediaFromValue(
  value: MediaReference | unknown
): MediaReference | null {
  return isMediaReference(value) ? value : null;
}
