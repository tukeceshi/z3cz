import {
  getMediaReferenceKey,
  type MediaReference,
} from "@dafthunk/types";
import {
  useInternalNode,
  useNodeId,
  useStore,
  useViewport,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import {
  canvasTierToDisplaySize,
  computeCanvasScreenShortEdge,
  pickCanvasMediaTierWithHysteresis,
  type CanvasMediaTier,
} from "@/services/canvas-media-tier";
import type { MediaDisplaySize } from "@/services/media-display-size";
import { CACHE_STATS_EVENT } from "@/services/ai-media-cache-events";
import { dropStableBlobUrlsForMediaId } from "@/services/media-display-blob-url-registry";
import { ingestCanvasMediaInBackground } from "@/services/ingest-canvas-media";
import {
  pickCanvasTierUrl,
  resolveCanvasTierUrlSet,
  resolveStableCanvasTierUrlSet,
  type CanvasTierUrlSet,
} from "@/services/resolve-resource-display-url";

function useCanvasNodeOnScreen(
  fallbackWidthPx: number,
  fallbackHeightPx: number
): boolean {
  const nodeId = useNodeId();
  const internalNode = useInternalNode(nodeId ?? "");
  const transform = useStore((state) => state.transform);
  const viewportWidth = useStore((state) => state.width);
  const viewportHeight = useStore((state) => state.height);

  return useMemo(() => {
    if (!nodeId || !internalNode) {
      return true;
    }

    const zoom = transform[2];
    if (
      !Number.isFinite(zoom) ||
      zoom <= 0 ||
      viewportWidth <= 0 ||
      viewportHeight <= 0
    ) {
      return true;
    }

    const viewX = -transform[0] / zoom;
    const viewY = -transform[1] / zoom;
    const viewW = viewportWidth / zoom;
    const viewH = viewportHeight / zoom;

    const nodeX = internalNode.internals.positionAbsolute.x;
    const nodeY = internalNode.internals.positionAbsolute.y;
    const nodeW =
      internalNode.measured?.width ??
      (typeof internalNode.width === "number" ? internalNode.width : fallbackWidthPx);
    const nodeH =
      internalNode.measured?.height ??
      (typeof internalNode.height === "number"
        ? internalNode.height
        : fallbackHeightPx);

    if (nodeW <= 0 || nodeH <= 0) {
      return true;
    }

    return (
      nodeX + nodeW > viewX &&
      nodeX < viewX + viewW &&
      nodeY + nodeH > viewY &&
      nodeY < viewY + viewH
    );
  }, [
    fallbackHeightPx,
    fallbackWidthPx,
    internalNode,
    nodeId,
    transform,
    viewportHeight,
    viewportWidth,
  ]);
}

function useCanvasMediaTier(): {
  readonly tierSize: MediaDisplaySize;
} {
  const { zoom } = useViewport();
  const tierRef = useRef<CanvasMediaTier>("s");

  const neededPixels = useMemo(
    () => computeCanvasScreenShortEdge(zoom),
    [zoom]
  );

  const tier = useMemo(() => {
    const next = pickCanvasMediaTierWithHysteresis(
      neededPixels,
      tierRef.current
    );
    tierRef.current = next;
    return next;
  }, [neededPixels]);

  return { tierSize: canvasTierToDisplaySize(tier) };
}

export function useCanvasMediaCoverUrl(params: {
  readonly media: MediaReference | null;
  readonly nodeType: "ai-image" | "ai-video";
  readonly cardWidthPx: number;
  readonly cardHeightPx?: number;
}): {
  readonly displayUrl: string | null;
  readonly stale: boolean;
  readonly tierSize: MediaDisplaySize;
  readonly isCanvasOnScreen: boolean;
  readonly retry: () => void;
} {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id ?? "";
  const mediaKey = useMemo(
    () => (params.media ? getMediaReferenceKey(params.media) : null),
    [params.media]
  );
  const cardHeightPx = params.cardHeightPx ?? params.cardWidthPx;
  const nodeId = useNodeId();
  const isOffCanvasContext = !nodeId;
  const isCanvasOnScreen = useCanvasNodeOnScreen(
    params.cardWidthPx,
    cardHeightPx
  );
  const { tierSize } = useCanvasMediaTier();

  const [tierUrlSet, setTierUrlSet] = useState<CanvasTierUrlSet | null>(() => {
    if (!params.media || !orgId || !workflowId) {
      return null;
    }
    return resolveStableCanvasTierUrlSet({
      media: params.media,
      organizationId: orgId,
      workflowId,
    });
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
      setTierUrlSet(null);
      return;
    }

    const stable = resolveStableCanvasTierUrlSet({
      media: params.media,
      organizationId: orgId,
      workflowId,
    });
    if (stable) {
      setTierUrlSet(stable);
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
        setTierUrlSet(set);
        return;
      }

      ingestCanvasMediaInBackground({
        organizationId: orgId,
        workflowId,
        media: params.media!,
        nodeType: params.nodeType,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    cacheRevision,
    mediaKey,
    orgId,
    params.media,
    params.nodeType,
    workflowId,
  ]);

  const displayUrl = useMemo(() => {
    if (!tierUrlSet) {
      return null;
    }
    if (isOffCanvasContext || !isCanvasOnScreen) {
      return tierUrlSet.s;
    }
    return pickCanvasTierUrl(
      tierUrlSet,
      tierSize as "canvas-s" | "canvas-m" | "canvas-l"
    );
  }, [isCanvasOnScreen, isOffCanvasContext, tierSize, tierUrlSet]);

  const retry = useCallback(() => {
    if (mediaKey) {
      dropStableBlobUrlsForMediaId(mediaKey);
    }
    setTierUrlSet(null);
    setCacheRevision((value) => value + 1);
  }, [mediaKey]);

  return {
    displayUrl,
    stale: Boolean(params.media && !tierUrlSet),
    tierSize,
    isCanvasOnScreen,
    retry,
  };
}
