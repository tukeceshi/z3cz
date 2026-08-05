import { AI_AUDIO_NODE_TYPE, AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import type { ReactFlowInstance, Node as ReactFlowNode } from "@xyflow/react";

import { resolveGenerativeLayoutContentSize } from "./generative-node-content-geometry";
import { GENERATIVE_EDGE_PLUS_OUTER_PX } from "./generative-edge-connection-config";
import type { WorkflowNodeType } from "./workflow-types";

/** Same spacing as Dagre layout (`nodesep` / `ranksep`). */
export const WORKFLOW_NODE_GAP_PX = 100;

/**
 * Card-edge gap when adding nodes — matches visual spacing after Dagre relayout
 * (~70px), without changing layout config.
 */
export const WORKFLOW_NODE_ADD_GAP_PX =
  WORKFLOW_NODE_GAP_PX - GENERATIVE_EDGE_PLUS_OUTER_PX;

/** Finer step for center-outward placement search (avoids ~400px grid gaps). */
export const WORKFLOW_NODE_PLACEMENT_SPIRAL_STEP_PX = 40;

export const WORKFLOW_CANVAS_EDGE_PADDING_PX = 24;

/** Bottom toolbar + margin — excluded from viewport placement search. */
export const WORKFLOW_CANVAS_BOTTOM_RESERVED_PX = 96;

export interface FlowRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FlowBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface FlowPoint {
  readonly x: number;
  readonly y: number;
}

export interface NodeDimensions {
  readonly width: number;
  readonly height: number;
}

export interface NodePlacementResult {
  readonly position: { readonly x: number; readonly y: number };
  readonly shouldPanIntoView: boolean;
}

type PlacementNode = Pick<
  ReactFlowNode<WorkflowNodeType>,
  "id" | "position" | "measured" | "width" | "height" | "data"
>;

export function resolveWorkflowNodeDimensions(
  nodeType: string | undefined,
  node?: Pick<ReactFlowNode, "measured" | "width" | "height">
): NodeDimensions {
  if (
    nodeType === AI_TEXT_NODE_TYPE ||
    nodeType === AI_IMAGE_NODE_TYPE ||
    nodeType === AI_VIDEO_NODE_TYPE ||
    nodeType === AI_AUDIO_NODE_TYPE
  ) {
    return resolveGenerativeLayoutContentSize(nodeType, node);
  }

  if (node?.measured?.width && node?.measured?.height) {
    return { width: node.measured.width, height: node.measured.height };
  }
  if (node?.width && node?.height) {
    return { width: node.width, height: node.height };
  }
  const isOutputNode = nodeType?.startsWith("output-") ?? false;
  return { width: 200, height: isOutputNode ? 250 : 100 };
}

/** Card size for add-node placement; image/video prefer measured adaptive size. */
export function resolveWorkflowNodeCardSizeForPlacement(
  nodeType: string | undefined,
  node?: Pick<ReactFlowNode, "measured" | "width" | "height">
): NodeDimensions {
  if (
    nodeType === AI_TEXT_NODE_TYPE ||
    nodeType === AI_IMAGE_NODE_TYPE ||
    nodeType === AI_VIDEO_NODE_TYPE ||
    nodeType === AI_AUDIO_NODE_TYPE
  ) {
    return resolveGenerativeLayoutContentSize(nodeType, node);
  }

  if (node?.measured?.width && node?.measured?.height) {
    return { width: node.measured.width, height: node.measured.height };
  }
  if (node?.width && node?.height) {
    return { width: node.width, height: node.height };
  }
  const isOutputNode = nodeType?.startsWith("output-") ?? false;
  return { width: 200, height: isOutputNode ? 250 : 100 };
}

export function collectOccupiedRects(
  nodes: readonly PlacementNode[],
  excludeNodeId?: string
): readonly FlowRect[] {
  return nodes
    .filter((node) => node.id !== excludeNodeId)
    .map((node) => {
      const dims = resolveWorkflowNodeCardSizeForPlacement(
        node.data.nodeType,
        node
      );
      return {
        x: node.position.x,
        y: node.position.y,
        width: dims.width,
        height: dims.height,
      };
    });
}

function rectsCollide(a: FlowRect, b: FlowRect, gap: number): boolean {
  const separated =
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y;
  return !separated;
}

function overlapsOccupied(
  candidate: FlowRect,
  occupied: readonly FlowRect[],
  gap: number
): boolean {
  return occupied.some((rect) => rectsCollide(candidate, rect, gap));
}

function isRectInsideBounds(rect: FlowRect, bounds: FlowBounds): boolean {
  return (
    rect.x >= bounds.minX &&
    rect.y >= bounds.minY &&
    rect.x + rect.width <= bounds.maxX &&
    rect.y + rect.height <= bounds.maxY
  );
}

function isValidPlacementCandidate(
  candidate: FlowRect,
  bounds: FlowBounds,
  occupied: readonly FlowRect[],
  gap: number
): boolean {
  return (
    isRectInsideBounds(candidate, bounds) &&
    !overlapsOccupied(candidate, occupied, gap)
  );
}

export function getViewportCenterFromBounds(bounds: FlowBounds): FlowPoint {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

export function getViewportCenterFlowPoint(
  reactFlowInstance: ReactFlowInstance,
  padding: {
    readonly top?: number;
    readonly right?: number;
    readonly bottom?: number;
    readonly left?: number;
  } = {}
): FlowPoint {
  const bounds = getViewportFlowBounds(reactFlowInstance, padding);
  return getViewportCenterFromBounds(bounds);
}

export function getViewportFlowBounds(
  reactFlowInstance: ReactFlowInstance,
  padding: {
    readonly top?: number;
    readonly right?: number;
    readonly bottom?: number;
    readonly left?: number;
  } = {}
): FlowBounds {
  const top = padding.top ?? WORKFLOW_CANVAS_EDGE_PADDING_PX;
  const right = padding.right ?? WORKFLOW_CANVAS_EDGE_PADDING_PX;
  const bottom = padding.bottom ?? WORKFLOW_CANVAS_BOTTOM_RESERVED_PX;
  const left = padding.left ?? WORKFLOW_CANVAS_EDGE_PADDING_PX;

  const pane = document.querySelector<HTMLElement>(".react-flow");
  if (!pane) {
    const center = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    return {
      minX: center.x - 400,
      minY: center.y - 300,
      maxX: center.x + 400,
      maxY: center.y + 300,
    };
  }

  const rect = pane.getBoundingClientRect();
  const topLeft = reactFlowInstance.screenToFlowPosition({
    x: rect.left + left,
    y: rect.top + top,
  });
  const bottomRight = reactFlowInstance.screenToFlowPosition({
    x: rect.right - right,
    y: rect.bottom - bottom,
  });

  return {
    minX: Math.min(topLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, bottomRight.y),
    maxX: Math.max(topLeft.x, bottomRight.x),
    maxY: Math.max(topLeft.y, bottomRight.y),
  };
}

function resolveCenterSpiralMaxRadius(
  bounds: FlowBounds,
  center: FlowPoint,
  nodeSize: NodeDimensions
): number {
  const halfWidth = nodeSize.width / 2;
  const halfHeight = nodeSize.height / 2;
  const corners: readonly FlowPoint[] = [
    { x: bounds.minX + halfWidth, y: bounds.minY + halfHeight },
    { x: bounds.maxX - halfWidth, y: bounds.minY + halfHeight },
    { x: bounds.minX + halfWidth, y: bounds.maxY - halfHeight },
    { x: bounds.maxX - halfWidth, y: bounds.maxY - halfHeight },
  ];

  let maxRadius = 0;
  for (const corner of corners) {
    const dx = corner.x - center.x;
    const dy = corner.y - center.y;
    maxRadius = Math.max(maxRadius, Math.hypot(dx, dy));
  }

  return maxRadius + Math.max(nodeSize.width, nodeSize.height);
}

function* iterateCenterSpiralOffsets(
  spiralStep: number,
  maxRadius: number
): Generator<{ readonly dx: number; readonly dy: number }> {
  yield { dx: 0, dy: 0 };

  for (let radius = spiralStep; radius <= maxRadius + 0.5; radius += spiralStep) {
    for (let dx = -radius; dx <= radius + 0.5; dx += spiralStep) {
      yield { dx, dy: -radius };
      yield { dx, dy: radius };
    }

    for (let dy = -radius + spiralStep; dy < radius - 0.5; dy += spiralStep) {
      yield { dx: -radius, dy };
      yield { dx: radius, dy };
    }
  }
}

/** Phase A: search outward from the viewport center (ring-by-ring, early exit). */
export function findOpenNodePositionFromCenter(
  bounds: FlowBounds,
  center: FlowPoint,
  nodeSize: NodeDimensions,
  occupied: readonly FlowRect[],
  gap: number = WORKFLOW_NODE_ADD_GAP_PX,
  spiralStep: number = WORKFLOW_NODE_PLACEMENT_SPIRAL_STEP_PX
): { readonly position: FlowPoint } | null {
  const baseX = center.x - nodeSize.width / 2;
  const baseY = center.y - nodeSize.height / 2;
  const maxRadius = resolveCenterSpiralMaxRadius(bounds, center, nodeSize);

  for (const { dx, dy } of iterateCenterSpiralOffsets(spiralStep, maxRadius)) {
    const x = baseX + dx;
    const y = baseY + dy;
    const candidate: FlowRect = {
      x,
      y,
      width: nodeSize.width,
      height: nodeSize.height,
    };
    if (isValidPlacementCandidate(candidate, bounds, occupied, gap)) {
      return { position: { x, y } };
    }
  }

  return null;
}

export function collectSnugAdjacencyCandidates(
  occupied: readonly FlowRect[],
  nodeSize: NodeDimensions,
  gap: number
): readonly FlowRect[] {
  const candidates: FlowRect[] = [];
  for (const rect of occupied) {
    candidates.push({
      x: rect.x + rect.width + gap,
      y: rect.y,
      width: nodeSize.width,
      height: nodeSize.height,
    });
    candidates.push({
      x: rect.x,
      y: rect.y + rect.height + gap,
      width: nodeSize.width,
      height: nodeSize.height,
    });
  }
  return candidates;
}

function compareDistanceToCenter(
  a: FlowRect,
  b: FlowRect,
  center: FlowPoint
): number {
  const aCenterX = a.x + a.width / 2;
  const aCenterY = a.y + a.height / 2;
  const bCenterX = b.x + b.width / 2;
  const bCenterY = b.y + b.height / 2;
  const aDist = (aCenterX - center.x) ** 2 + (aCenterY - center.y) ** 2;
  const bDist = (bCenterX - center.x) ** 2 + (bCenterY - center.y) ** 2;
  return aDist - bDist;
}

/** Phase B: exact card-edge gap adjacent to existing nodes. */
export function findSnugAdjacencyPositionInBounds(
  bounds: FlowBounds,
  center: FlowPoint,
  nodeSize: NodeDimensions,
  occupied: readonly FlowRect[],
  gap: number = WORKFLOW_NODE_ADD_GAP_PX
): { readonly position: FlowPoint } | null {
  const candidates = [...collectSnugAdjacencyCandidates(occupied, nodeSize, gap)].sort(
    (a, b) => compareDistanceToCenter(a, b, center)
  );

  for (const candidate of candidates) {
    if (isValidPlacementCandidate(candidate, bounds, occupied, gap)) {
      return { position: { x: candidate.x, y: candidate.y } };
    }
  }

  return null;
}

/** Viewport placement: center spiral, then snug adjacency. */
export function findOpenNodePositionInBounds(
  bounds: FlowBounds,
  nodeSize: NodeDimensions,
  occupied: readonly FlowRect[],
  gap: number = WORKFLOW_NODE_ADD_GAP_PX
): { readonly position: FlowPoint } | null {
  const center = getViewportCenterFromBounds(bounds);
  const fromCenter = findOpenNodePositionFromCenter(
    bounds,
    center,
    nodeSize,
    occupied,
    gap
  );
  if (fromCenter) return fromCenter;

  return findSnugAdjacencyPositionInBounds(bounds, center, nodeSize, occupied, gap);
}

/** When the viewport has no room: prefer right of the cluster, then below. */
export function findFallbackNodePosition(
  occupied: readonly FlowRect[],
  nodeSize: NodeDimensions,
  gap: number = WORKFLOW_NODE_ADD_GAP_PX
): FlowPoint {
  if (occupied.length === 0) {
    return { x: 0, y: 0 };
  }

  let maxRight = -Infinity;
  let maxRightY = 0;
  let maxBottom = -Infinity;
  let minX = Infinity;

  for (const rect of occupied) {
    const right = rect.x + rect.width;
    if (right > maxRight) {
      maxRight = right;
      maxRightY = rect.y;
    }
    maxBottom = Math.max(maxBottom, rect.y + rect.height);
    minX = Math.min(minX, rect.x);
  }

  const rightCandidate: FlowRect = {
    x: maxRight + gap,
    y: maxRightY,
    width: nodeSize.width,
    height: nodeSize.height,
  };
  if (!overlapsOccupied(rightCandidate, occupied, gap)) {
    return { x: rightCandidate.x, y: rightCandidate.y };
  }

  return { x: minX, y: maxBottom + gap };
}

function findOpenNodePositionNearSeed(
  seed: FlowPoint,
  nodeSize: NodeDimensions,
  occupied: readonly FlowRect[],
  gap: number = WORKFLOW_NODE_ADD_GAP_PX,
  spiralStep: number = WORKFLOW_NODE_PLACEMENT_SPIRAL_STEP_PX
): FlowPoint {
  const baseX = seed.x - nodeSize.width / 2;
  const baseY = seed.y - nodeSize.height / 2;
  const maxRadius =
    Math.max(nodeSize.width, nodeSize.height) * 8 + WORKFLOW_NODE_GAP_PX * 4;

  for (const { dx, dy } of iterateCenterSpiralOffsets(spiralStep, maxRadius)) {
    const candidate: FlowRect = {
      x: baseX + dx,
      y: baseY + dy,
      width: nodeSize.width,
      height: nodeSize.height,
    };
    if (!overlapsOccupied(candidate, occupied, gap)) {
      return { x: candidate.x, y: candidate.y };
    }
  }

  return { x: baseX, y: baseY };
}

/** Place a node near a flow point (e.g. context-menu click), avoiding overlaps. */
export function findOpenNodePositionNearPoint(params: {
  readonly flowPoint: FlowPoint;
  readonly nodeType: string | undefined;
  readonly existingNodes: readonly PlacementNode[];
}): FlowPoint {
  const nodeSize = resolveWorkflowNodeCardSizeForPlacement(params.nodeType);
  const occupied = collectOccupiedRects(params.existingNodes);
  return findOpenNodePositionNearSeed(params.flowPoint, nodeSize, occupied);
}

/** Place a new node to the right of a source generative node. */
export function findOpenNodePositionFromSource(params: {
  readonly sourceNode: PlacementNode;
  readonly targetNodeType: string | undefined;
  readonly existingNodes: readonly PlacementNode[];
  readonly dropFlowY?: number;
}): FlowPoint {
  const sourceDims = resolveWorkflowNodeDimensions(
    params.sourceNode.data.nodeType,
    params.sourceNode
  );
  const targetDims = resolveWorkflowNodeCardSizeForPlacement(
    params.targetNodeType
  );
  const occupied = collectOccupiedRects(params.existingNodes);
  const seedY =
    params.dropFlowY ??
    params.sourceNode.position.y + sourceDims.height / 2;

  return findOpenNodePositionNearSeed(
    {
      x:
        params.sourceNode.position.x +
        sourceDims.width +
        WORKFLOW_NODE_ADD_GAP_PX +
        targetDims.width / 2,
      y: seedY,
    },
    targetDims,
    occupied
  );
}

export function findOpenNodePosition(params: {
  readonly reactFlowInstance: ReactFlowInstance;
  readonly nodeType: string | undefined;
  readonly existingNodes: readonly PlacementNode[];
}): NodePlacementResult {
  const nodeSize = resolveWorkflowNodeCardSizeForPlacement(params.nodeType);
  const occupied = collectOccupiedRects(params.existingNodes);
  const bounds = getViewportFlowBounds(params.reactFlowInstance);
  const center = getViewportCenterFromBounds(bounds);

  if (occupied.length > 0) {
    const snug = findSnugAdjacencyPositionInBounds(
      bounds,
      center,
      nodeSize,
      occupied
    );
    if (snug) {
      return { position: snug.position, shouldPanIntoView: false };
    }
  }

  const fromCenter = findOpenNodePositionFromCenter(
    bounds,
    center,
    nodeSize,
    occupied
  );
  if (fromCenter) {
    return { position: fromCenter.position, shouldPanIntoView: false };
  }

  const fallback = findFallbackNodePosition(occupied, nodeSize);
  const fallbackRect: FlowRect = {
    ...fallback,
    width: nodeSize.width,
    height: nodeSize.height,
  };

  return {
    position: fallback,
    shouldPanIntoView: !isRectInsideBounds(fallbackRect, bounds),
  };
}
