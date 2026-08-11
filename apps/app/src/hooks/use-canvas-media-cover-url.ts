import {
  type WorkflowMediaValue,
} from "@dafthunk/types";
import {
  useInternalNode,
  useNodeId,
  useStore,
  useViewport,
} from "@xyflow/react";
import { useMemo, useRef } from "react";

import {
  canvasTierToDisplaySize,
  computeCanvasScreenShortEdge,
  pickCanvasMediaTierWithHysteresis,
  type CanvasMediaTier,
} from "@/services/canvas-media-tier";
import type { MediaDisplaySize } from "@/services/media-display-size";
import { pickMediaDisplayUrl } from "@/services/resolve-resource-display-url";

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

export function useCanvasMediaCoverUrl(params: {
  readonly media: WorkflowMediaValue | null;
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
  const cardHeightPx = params.cardHeightPx ?? params.cardWidthPx;
  const nodeId = useNodeId();
  const isOffCanvasContext = !nodeId;
  const isCanvasOnScreen = useCanvasNodeOnScreen(
    params.cardWidthPx,
    cardHeightPx
  );
  const { tierSize } = useCanvasMediaTier();
  const { urlSet, stale, retry } = useMediaDisplayUrlSet({
    media: params.media,
    nodeType: params.nodeType,
  });

  const displayUrl = useMemo(() => {
    if (!params.media) {
      return null;
    }

    const pickSize = (
      isOffCanvasContext || !isCanvasOnScreen
        ? "canvas-s"
        : tierSize
    ) as MediaDisplaySize;

    return pickMediaDisplayUrl(urlSet, pickSize);
  }, [
    isCanvasOnScreen,
    isOffCanvasContext,
    params.media,
    tierSize,
    urlSet,
  ]);

  return {
    displayUrl,
    stale,
    tierSize,
    isCanvasOnScreen,
    retry,
  };
}
