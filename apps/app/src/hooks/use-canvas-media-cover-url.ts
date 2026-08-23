import {
  type WorkflowMediaValue,
} from "@dafthunk/types";
import {
  useInternalNode,
  useNodeId,
  useStore,
  useViewport,
} from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useWorkflowGraph } from "@/components/workflow/workflow-context";
import type { SharedMediaDisplayUrlSet } from "@/hooks/use-media-display-url";
import type { MediaDisplayUrlSet } from "@/services/ai-media-cache-service";
import {
  CANVAS_MEDIA_TIER_SETTLE_MS,
  canvasTierToDisplaySize,
  computeCanvasScreenShortEdge,
  pickCanvasMediaTierWithHysteresis,
  type CanvasMediaTier,
} from "@/services/canvas-media-tier";
import type { MediaDisplaySize } from "@/services/media-display-size";
import {
  resolveMediaDisplay,
  type MediaDisplayPhase,
} from "@/services/media-display-readiness";

import { useMediaDisplayUrlSet } from "./use-media-display-url-set";

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

function resolveLivePickSize(params: {
  readonly media: WorkflowMediaValue | null;
  readonly isOffCanvasContext: boolean;
  readonly isCanvasOnScreen: boolean;
  readonly tierSize: MediaDisplaySize;
}): MediaDisplaySize | null {
  if (!params.media) {
    return null;
  }

  if (params.isOffCanvasContext || !params.isCanvasOnScreen) {
    return "canvas-s";
  }

  return params.tierSize;
}

/** Debounced pick size — frozen while panning/zooming, applied after gesture settles. */
function useSettledCanvasPickSize(
  livePickSize: MediaDisplaySize | null
): MediaDisplaySize {
  const { isViewportMoving } = useWorkflowGraph();
  const [effectivePickSize, setEffectivePickSize] =
    useState<MediaDisplaySize>("canvas-s");
  const settleTimerRef = useRef<number | null>(null);
  const hadGestureRef = useRef(false);

  useEffect(() => {
    if (livePickSize == null) {
      return;
    }

    if (isViewportMoving) {
      hadGestureRef.current = true;
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      return;
    }

    if (!hadGestureRef.current) {
      setEffectivePickSize(livePickSize);
      return;
    }

    hadGestureRef.current = false;
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }

    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      setEffectivePickSize(livePickSize);
    }, CANVAS_MEDIA_TIER_SETTLE_MS);

    return () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [isViewportMoving, livePickSize]);

  return effectivePickSize;
}

export function useCanvasMediaCoverUrl(params: {
  readonly media: WorkflowMediaValue | null;
  readonly nodeType: "ai-image" | "ai-video";
  readonly cardWidthPx: number;
  readonly cardHeightPx?: number;
  readonly sharedUrlSet?: SharedMediaDisplayUrlSet;
}): {
  readonly displayUrl: string | null;
  readonly phase: MediaDisplayPhase;
  readonly stale: boolean;
  readonly tierSize: MediaDisplaySize;
  readonly isCanvasOnScreen: boolean;
  readonly urlSet: MediaDisplayUrlSet;
  readonly retry: () => void;
} {
  const cardHeightPx = params.cardHeightPx ?? params.cardWidthPx;
  const nodeId = useNodeId();
  const isOffCanvasContext = !nodeId;
  const isCanvasOnScreen = useCanvasNodeOnScreen(
    params.cardWidthPx,
    cardHeightPx
  );
  const { tierSize } = useCanvasMediaTier();
  const livePickSize = useMemo(
    () =>
      resolveLivePickSize({
        media: params.media,
        isOffCanvasContext,
        isCanvasOnScreen,
        tierSize,
      }),
    [isCanvasOnScreen, isOffCanvasContext, params.media, tierSize]
  );
  const effectivePickSize = useSettledCanvasPickSize(livePickSize);
  const internalUrlSet = useMediaDisplayUrlSet({
    media: params.sharedUrlSet ? null : params.media,
    nodeType: params.nodeType,
    preferredSize: effectivePickSize,
  });
  const urlSet = params.sharedUrlSet?.urlSet ?? internalUrlSet.urlSet;
  const stale = params.sharedUrlSet?.stale ?? internalUrlSet.stale;
  const retry = params.sharedUrlSet?.retry ?? internalUrlSet.retry;

  const display = useMemo(
    () =>
      resolveMediaDisplay({
        media: params.media,
        urlSet,
        size: effectivePickSize,
        stale,
      }),
    [effectivePickSize, params.media, stale, urlSet]
  );

  return {
    displayUrl: display.displayUrl,
    phase: display.phase,
    stale,
    tierSize: effectivePickSize,
    isCanvasOnScreen,
    urlSet,
    retry,
  };
}
