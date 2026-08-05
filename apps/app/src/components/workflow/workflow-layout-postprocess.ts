import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import {
  AI_IMAGE_OUTPUT_ID,
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
} from "./ai-image-node-utils";
import { resolveWorkflowEdgeHandles } from "./ai-text-connection-utils";
import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_OUTPUT_ID,
  isAiTextAllowedReferenceNodeType,
} from "./ai-text-node-utils";
import {
  AI_VIDEO_OUTPUT_ID,
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
} from "./ai-video-node-utils";
import { WORKFLOW_NODE_GAP_PX } from "./workflow-node-placement";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

/** Dagre same-rank nodes share nearly identical flowX. */
const GENERATIVE_COLUMN_SAME_X_TOLERANCE_PX = 5;

/** Reference fan-out: snap when targets are already near source centerY. */
const REFERENCE_NEAR_ALIGN_TOLERANCE_PX = WORKFLOW_NODE_GAP_PX / 2;

type SnapEdgeKind = "reference" | "keywords" | "prompt";

const SNAP_KIND_PRIORITY: ReadonlyRecord<SnapEdgeKind, number> = {
  reference: 0,
  keywords: 1,
  prompt: 2,
};

export interface LayoutPosition {
  readonly x: number;
  readonly y: number;
}

export interface LayoutDimensions {
  readonly width: number;
  readonly height: number;
}

function cloneLayoutPositions(
  positions: ReadonlyMap<string, LayoutPosition>
): Map<string, LayoutPosition> {
  return new Map(
    [...positions.entries()].map(([id, position]) => [id, { ...position }] as const)
  );
}

function snapTargetCenterYToSource(
  positions: Map<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  sourceId: string,
  targetId: string
): boolean {
  const sourcePos = positions.get(sourceId);
  const targetPos = positions.get(targetId);
  const sourceDim = dimensions.get(sourceId);
  const targetDim = dimensions.get(targetId);
  if (!sourcePos || !targetPos || !sourceDim || !targetDim) return false;

  const sourceCenterY = sourcePos.y + sourceDim.height / 2;
  const nextY = sourceCenterY - targetDim.height / 2;
  if (targetPos.y === nextY) return false;

  positions.set(targetId, {
    ...targetPos,
    y: nextY,
  });
  return true;
}

function isForwardEdge(
  positions: ReadonlyMap<string, LayoutPosition>,
  sourceId: string,
  targetId: string
): boolean {
  const sourcePos = positions.get(sourceId);
  const targetPos = positions.get(targetId);
  if (!sourcePos || !targetPos) return false;
  return targetPos.x > sourcePos.x;
}

function shouldSkipReferenceFanOutSnap(
  positions: ReadonlyMap<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  sourceId: string,
  targetId: string,
  fanOutCount: number,
  tolerancePx: number = REFERENCE_NEAR_ALIGN_TOLERANCE_PX
): boolean {
  if (fanOutCount <= 1) return false;

  const sourcePos = positions.get(sourceId);
  const targetPos = positions.get(targetId);
  const sourceDim = dimensions.get(sourceId);
  const targetDim = dimensions.get(targetId);
  if (!sourcePos || !targetPos || !sourceDim || !targetDim) return true;

  const sourceCenterY = sourcePos.y + sourceDim.height / 2;
  const targetCenterY = targetPos.y + targetDim.height / 2;
  return Math.abs(sourceCenterY - targetCenterY) > tolerancePx;
}

function isAiTextToMediaPromptEdge(
  edge: ReactFlowEdge<WorkflowEdgeType>,
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>
): boolean {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target) return false;
  if (source.data.nodeType !== AI_TEXT_NODE_TYPE) return false;
  if (
    target.data.nodeType !== AI_IMAGE_NODE_TYPE &&
    target.data.nodeType !== AI_VIDEO_NODE_TYPE
  ) {
    return false;
  }

  const handles = resolveWorkflowEdgeHandles({
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    dataSourceHandle: edge.data?.sourceHandle,
    dataTargetHandle: edge.data?.targetHandle,
  });

  if (handles.sourceHandle !== AI_TEXT_OUTPUT_ID && handles.sourceHandle !== undefined) {
    return false;
  }

  return (
    handles.targetHandle === AI_IMAGE_PROMPT_HANDLE_ID ||
    handles.targetHandle === AI_VIDEO_PROMPT_HANDLE_ID
  );
}

function isGenerativeToAiTextKeywordsEdge(
  edge: ReactFlowEdge<WorkflowEdgeType>,
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>
): boolean {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target) return false;
  if (target.data.nodeType !== AI_TEXT_NODE_TYPE) return false;
  if (!isAiTextAllowedReferenceNodeType(source.data.nodeType)) return false;

  const handles = resolveWorkflowEdgeHandles({
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    dataSourceHandle: edge.data?.sourceHandle,
    dataTargetHandle: edge.data?.targetHandle,
  });

  if (handles.targetHandle !== AI_TEXT_KEYWORDS_HANDLE_ID) return false;

  return (
    handles.sourceHandle === AI_IMAGE_OUTPUT_ID ||
    handles.sourceHandle === AI_VIDEO_OUTPUT_ID ||
    handles.sourceHandle === AI_TEXT_OUTPUT_ID ||
    handles.sourceHandle === undefined
  );
}

function isGenerativeReferenceEdge(
  edge: ReactFlowEdge<WorkflowEdgeType>,
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>
): boolean {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target) return false;
  if (source.data.nodeType !== AI_IMAGE_NODE_TYPE) return false;

  const handles = resolveWorkflowEdgeHandles({
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    dataSourceHandle: edge.data?.sourceHandle,
    dataTargetHandle: edge.data?.targetHandle,
  });

  if (handles.sourceHandle !== AI_IMAGE_OUTPUT_ID && handles.sourceHandle !== undefined) {
    return false;
  }

  if (
    target.data.nodeType === AI_IMAGE_NODE_TYPE &&
    handles.targetHandle === AI_IMAGE_REFERENCE_HANDLE_ID
  ) {
    return true;
  }

  return (
    target.data.nodeType === AI_VIDEO_NODE_TYPE &&
    handles.targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID
  );
}

function getSnapEdgeKind(
  edge: ReactFlowEdge<WorkflowEdgeType>,
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>,
  positions: ReadonlyMap<string, LayoutPosition>
): SnapEdgeKind | null {
  if (!isForwardEdge(positions, edge.source, edge.target)) return null;
  if (isGenerativeReferenceEdge(edge, nodesById)) return "reference";
  if (isGenerativeToAiTextKeywordsEdge(edge, nodesById)) return "keywords";
  if (isAiTextToMediaPromptEdge(edge, nodesById)) return "prompt";
  return null;
}

/**
 * When one source has snap edges of multiple kinds, record the highest-priority
 * edge per source (reference > keywords > prompt).
 */
function buildCrossTypePrimarySnapEdgeBySource(
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[],
  positions: ReadonlyMap<string, LayoutPosition>,
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>
): ReadonlyMap<string, string> {
  const bySource = new Map<
    string,
    Array<{ edgeId: string; priority: number; kind: SnapEdgeKind }>
  >();

  for (const edge of edges) {
    const kind = getSnapEdgeKind(edge, nodesById, positions);
    if (!kind) continue;

    const entry = {
      edgeId: edge.id,
      priority: SNAP_KIND_PRIORITY[kind],
      kind,
    };
    const group = bySource.get(edge.source);
    if (group) {
      group.push(entry);
    } else {
      bySource.set(edge.source, [entry]);
    }
  }

  const primaryBySource = new Map<string, string>();

  for (const [sourceId, group] of bySource) {
    if (group.length <= 1) continue;

    const kinds = new Set(group.map((entry) => entry.kind));
    if (kinds.size <= 1) continue;

    const primary = [...group].sort((a, b) => a.priority - b.priority)[0]!;
    primaryBySource.set(sourceId, primary.edgeId);
  }

  return primaryBySource;
}

function snappedTargetYAfterSourceCenterYAlign(
  sourceId: string,
  targetId: string,
  positions: ReadonlyMap<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>
): number | null {
  const sourcePos = positions.get(sourceId);
  const targetPos = positions.get(targetId);
  const sourceDim = dimensions.get(sourceId);
  const targetDim = dimensions.get(targetId);
  if (!sourcePos || !targetPos || !sourceDim || !targetDim) return null;

  return sourcePos.y + sourceDim.height / 2 - targetDim.height / 2;
}

function layoutBoxesOverlap(
  a: LayoutPosition & LayoutDimensions,
  b: LayoutPosition & LayoutDimensions
): boolean {
  const overlapWidth =
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapHeight =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapWidth > 0 && overlapHeight > 0;
}

function wouldOverlapPrimaryTargetAfterCandidateSnap(
  sourceId: string,
  primaryTargetId: string,
  candidateTargetId: string,
  positions: ReadonlyMap<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>
): boolean {
  const primaryPos = positions.get(primaryTargetId);
  const candidatePos = positions.get(candidateTargetId);
  const primaryDim = dimensions.get(primaryTargetId);
  const candidateDim = dimensions.get(candidateTargetId);
  const candidateY = snappedTargetYAfterSourceCenterYAlign(
    sourceId,
    candidateTargetId,
    positions,
    dimensions
  );
  if (
    !primaryPos ||
    !candidatePos ||
    !primaryDim ||
    !candidateDim ||
    candidateY === null
  ) {
    return false;
  }

  return layoutBoxesOverlap(
    { ...primaryPos, ...primaryDim },
    { ...candidatePos, y: candidateY, ...candidateDim }
  );
}

function shouldSkipCrossTypeSourceFanOut(
  edge: ReactFlowEdge<WorkflowEdgeType>,
  primarySnapEdgeBySource: ReadonlyMap<string, string>,
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[],
  positions: ReadonlyMap<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>
): boolean {
  const primaryEdgeId = primarySnapEdgeBySource.get(edge.source);
  if (!primaryEdgeId || edge.id === primaryEdgeId) return false;

  const primaryEdge = edges.find((candidate) => candidate.id === primaryEdgeId);
  if (!primaryEdge) return false;

  return wouldOverlapPrimaryTargetAfterCandidateSnap(
    edge.source,
    primaryEdge.target,
    edge.target,
    positions,
    dimensions
  );
}

function groupEdgesByKey<T extends ReactFlowEdge<WorkflowEdgeType>>(
  edges: readonly T[],
  keyOf: (edge: T) => string
): ReadonlyMap<string, readonly T[]> {
  const groups = new Map<string, T[]>();
  for (const edge of edges) {
    const key = keyOf(edge);
    const group = groups.get(key);
    if (group) {
      group.push(edge);
    } else {
      groups.set(key, [edge]);
    }
  }
  return groups;
}

function pickLeftmostSourceEdge<T extends ReactFlowEdge<WorkflowEdgeType>>(
  edges: readonly T[],
  positions: ReadonlyMap<string, LayoutPosition>
): T {
  return [...edges].sort((a, b) => {
    const ax = positions.get(a.source)?.x ?? 0;
    const bx = positions.get(b.source)?.x ?? 0;
    return ax - bx;
  })[0] as T;
}

function isGenerativeLayoutNodeType(nodeType: string | undefined): boolean {
  return (
    nodeType === AI_TEXT_NODE_TYPE ||
    nodeType === AI_IMAGE_NODE_TYPE ||
    nodeType === AI_VIDEO_NODE_TYPE ||
    nodeType === AI_AUDIO_NODE_TYPE
  );
}

interface ColumnLayoutNode {
  readonly id: string;
  x: number;
  y: number;
  readonly width: number;
  readonly height: number;
}

interface CenterXColumnLayoutNode extends ColumnLayoutNode {
  readonly centerX: number;
}

function layoutCenterX(
  position: LayoutPosition,
  dimension: LayoutDimensions
): number {
  return position.x + dimension.width / 2;
}

function isSameCenterXColumn(
  a: Pick<CenterXColumnLayoutNode, "centerX">,
  b: Pick<CenterXColumnLayoutNode, "centerX">
): boolean {
  return Math.abs(a.centerX - b.centerX) <= GENERATIVE_COLUMN_SAME_X_TOLERANCE_PX;
}

function isSameLayoutColumn(
  a: Pick<ColumnLayoutNode, "x">,
  b: Pick<ColumnLayoutNode, "x">
): boolean {
  return Math.abs(a.x - b.x) <= GENERATIVE_COLUMN_SAME_X_TOLERANCE_PX;
}

function clusterGenerativeNodesByColumn(
  positions: ReadonlyMap<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>
): ColumnLayoutNode[][] {
  const items: ColumnLayoutNode[] = [];

  for (const [id, flowNode] of nodesById) {
    if (!isGenerativeLayoutNodeType(flowNode.data.nodeType)) continue;
    const position = positions.get(id);
    const dimension = dimensions.get(id);
    if (!position || !dimension) continue;
    items.push({
      id,
      x: position.x,
      y: position.y,
      width: dimension.width,
      height: dimension.height,
    });
  }

  items.sort((a, b) => a.x - b.x || a.y - b.y);

  const clusters: ColumnLayoutNode[][] = [];
  for (const item of items) {
    const cluster = clusters.find((candidate) =>
      candidate.some((member) => isSameLayoutColumn(member, item))
    );
    if (cluster) {
      cluster.push(item);
    } else {
      clusters.push([item]);
    }
  }

  for (const cluster of clusters) {
    cluster.sort((a, b) => a.y - b.y);
  }

  return clusters;
}

function clusterGenerativeNodesByCenterXColumn(
  positions: ReadonlyMap<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>
): CenterXColumnLayoutNode[][] {
  const items: CenterXColumnLayoutNode[] = [];

  for (const [id, flowNode] of nodesById) {
    if (!isGenerativeLayoutNodeType(flowNode.data.nodeType)) continue;
    const position = positions.get(id);
    const dimension = dimensions.get(id);
    if (!position || !dimension) continue;
    items.push({
      id,
      x: position.x,
      y: position.y,
      width: dimension.width,
      height: dimension.height,
      centerX: layoutCenterX(position, dimension),
    });
  }

  items.sort((a, b) => a.centerX - b.centerX || a.y - b.y);

  const clusters: CenterXColumnLayoutNode[][] = [];
  for (const item of items) {
    const cluster = clusters.find((candidate) =>
      candidate.some((member) => isSameCenterXColumn(member, item))
    );
    if (cluster) {
      cluster.push(item);
    } else {
      clusters.push([item]);
    }
  }

  for (const cluster of clusters) {
    cluster.sort((a, b) => a.y - b.y);
  }

  return clusters;
}

function columnEdgeGap(
  upper: ColumnLayoutNode,
  lower: ColumnLayoutNode
): number {
  return lower.y - (upper.y + upper.height);
}

function nodeBreaksColumnGap(
  cluster: readonly ColumnLayoutNode[],
  nodeIndex: number,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  minGap: number
): boolean {
  const current = cluster[nodeIndex];
  const dim = dimensions.get(current.id);
  if (!dim) return false;

  if (nodeIndex > 0) {
    const gapAbove = columnEdgeGap(cluster[nodeIndex - 1]!, current);
    if (gapAbove < minGap) return true;
  }

  if (nodeIndex < cluster.length - 1) {
    const gapBelow = current.y + dim.height;
    const lower = cluster[nodeIndex + 1]!;
    if (lower.y - gapBelow < minGap) return true;
  }

  return false;
}

/**
 * Anchor the bottom node in each generative column; move upper nodes up to
 * restore WORKFLOW_NODE_GAP_PX edge spacing.
 */
export function enforceGenerativeColumnGapPushUp(
  positions: Map<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>,
  minGap: number = WORKFLOW_NODE_GAP_PX
): void {
  const clusters = clusterGenerativeNodesByColumn(positions, dimensions, nodesById);

  for (const cluster of clusters) {
    if (cluster.length < 2) continue;

    for (let index = cluster.length - 2; index >= 0; index -= 1) {
      const upper = cluster[index]!;
      const lower = cluster[index + 1]!;
      const maxUpperY = lower.y - minGap - upper.height;
      if (upper.y <= maxUpperY) continue;

      upper.y = maxUpperY;
      const position = positions.get(upper.id);
      if (!position) continue;
      positions.set(upper.id, { ...position, y: maxUpperY });
    }
  }
}

/**
 * After snap: push lower nodes down only when centerX column bboxes overlap.
 */
export function enforceGenerativeColumnGapPushDown(
  positions: Map<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>,
  minGap: number = WORKFLOW_NODE_GAP_PX
): void {
  const clusters = clusterGenerativeNodesByCenterXColumn(
    positions,
    dimensions,
    nodesById
  );

  for (const cluster of clusters) {
    if (cluster.length < 2) continue;

    for (let index = 1; index < cluster.length; index += 1) {
      const upper = cluster[index - 1]!;
      const lower = cluster[index]!;
      const overlapBottom = upper.y + upper.height;
      if (lower.y >= overlapBottom) continue;

      const minLowerY = overlapBottom + minGap;
      lower.y = minLowerY;
      const position = positions.get(lower.id);
      if (!position) continue;
      positions.set(lower.id, { ...position, y: minLowerY });
    }
  }
}

function rollbackSnapsBreakingColumnGap(
  positions: Map<string, LayoutPosition>,
  positionsBeforeSnap: ReadonlyMap<string, LayoutPosition>,
  snappedTargetIds: ReadonlySet<string>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>,
  minGap: number = WORKFLOW_NODE_GAP_PX
): void {
  if (snappedTargetIds.size === 0) return;

  const clusters = clusterGenerativeNodesByColumn(positions, dimensions, nodesById);

  for (const targetId of snappedTargetIds) {
    const cluster = clusters.find((candidate) =>
      candidate.some((member) => member.id === targetId)
    );
    if (!cluster || cluster.length < 2) continue;

    const nodeIndex = cluster.findIndex((member) => member.id === targetId);
    if (nodeIndex < 0) continue;

    if (!nodeBreaksColumnGap(cluster, nodeIndex, dimensions, minGap)) continue;

    const previous = positionsBeforeSnap.get(targetId);
    if (!previous) continue;
    positions.set(targetId, { ...previous });
  }
}

/**
 * Dagre postprocess: column gap, centerY snap, rollback conflicting snaps.
 */
export function applyWorkflowLayoutPostprocess(
  positions: Map<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[],
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>
): void {
  enforceGenerativeColumnGapPushUp(positions, dimensions, nodesById);

  const positionsBeforeSnap = cloneLayoutPositions(positions);
  const snappedTargetIds = new Set<string>();

  snapGenerativeFlowEdgeCenterY(
    positions,
    dimensions,
    edges,
    nodesById,
    snappedTargetIds
  );

  rollbackSnapsBreakingColumnGap(
    positions,
    positionsBeforeSnap,
    snappedTargetIds,
    dimensions,
    nodesById
  );

  enforceGenerativeColumnGapPushDown(positions, dimensions, nodesById);
}

/**
 * Align anchor center Y on flow + reference edges.
 * Pass 1 — reference, Pass 2 — keywords, Pass 3 — prompt.
 * Cross-type source fan-out: skip lower-priority edges only when snap targets overlap.
 */
export function snapGenerativeFlowEdgeCenterY(
  positions: Map<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[],
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>,
  snappedTargetIds: Set<string> = new Set<string>()
): void {
  const recordSnap = (sourceId: string, targetId: string): void => {
    if (snapTargetCenterYToSource(positions, dimensions, sourceId, targetId)) {
      snappedTargetIds.add(targetId);
    }
  };

  const primarySnapEdgeBySource = buildCrossTypePrimarySnapEdgeBySource(
    edges,
    positions,
    nodesById
  );

  const referenceEdges = edges
    .filter((edge) => isGenerativeReferenceEdge(edge, nodesById))
    .filter((edge) => isForwardEdge(positions, edge.source, edge.target));

  const referenceBySource = groupEdgesByKey(referenceEdges, (edge) => edge.source);
  const referenceByTarget = groupEdgesByKey(referenceEdges, (edge) => edge.target);
  const referenceFanInHandledTargets = new Set<string>();

  for (const group of referenceByTarget.values()) {
    if (group.length <= 1) continue;

    const primaryEdge = pickLeftmostSourceEdge(group, positions);
    if ((referenceBySource.get(primaryEdge.source)?.length ?? 0) > 1) continue;

    recordSnap(primaryEdge.source, primaryEdge.target);
    referenceFanInHandledTargets.add(primaryEdge.target);
  }

  for (const edge of referenceEdges) {
    if (referenceFanInHandledTargets.has(edge.target)) continue;
    if (shouldSkipCrossTypeSourceFanOut(
      edge,
      primarySnapEdgeBySource,
      edges,
      positions,
      dimensions
    )) {
      continue;
    }

    const sourceFanOut = referenceBySource.get(edge.source)?.length ?? 0;
    if (
      sourceFanOut > 1 &&
      shouldSkipReferenceFanOutSnap(
        positions,
        dimensions,
        edge.source,
        edge.target,
        sourceFanOut
      )
    ) {
      continue;
    }

    if ((referenceByTarget.get(edge.target)?.length ?? 0) > 1) continue;
    recordSnap(edge.source, edge.target);
  }

  const keywordsEdges = edges
    .filter((edge) => isGenerativeToAiTextKeywordsEdge(edge, nodesById))
    .filter((edge) => isForwardEdge(positions, edge.source, edge.target))
    .sort((a, b) => {
      const ax = positions.get(a.source)?.x ?? 0;
      const bx = positions.get(b.source)?.x ?? 0;
      return ax - bx;
    });

  const keywordsBySource = groupEdgesByKey(keywordsEdges, (edge) => edge.source);
  const keywordsByTarget = groupEdgesByKey(keywordsEdges, (edge) => edge.target);

  for (const edge of keywordsEdges) {
    if (shouldSkipCrossTypeSourceFanOut(
      edge,
      primarySnapEdgeBySource,
      edges,
      positions,
      dimensions
    )) {
      continue;
    }
    if ((keywordsBySource.get(edge.source)?.length ?? 0) > 1) continue;
    if ((keywordsByTarget.get(edge.target)?.length ?? 0) > 1) continue;
    recordSnap(edge.source, edge.target);
  }

  const promptEdges = edges
    .filter((edge) => isAiTextToMediaPromptEdge(edge, nodesById))
    .filter((edge) => isForwardEdge(positions, edge.source, edge.target));

  for (const group of groupEdgesByKey(promptEdges, (edge) => edge.source).values()) {
    if (group.length !== 1) continue;
    const edge = group[0]!;
    if (shouldSkipCrossTypeSourceFanOut(
      edge,
      primarySnapEdgeBySource,
      edges,
      positions,
      dimensions
    )) {
      continue;
    }
    recordSnap(edge.source, edge.target);
  }
}
