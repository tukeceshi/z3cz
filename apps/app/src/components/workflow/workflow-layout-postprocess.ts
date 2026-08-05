import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { AI_IMAGE_OUTPUT_ID, AI_IMAGE_PROMPT_HANDLE_ID } from "./ai-image-node-utils";
import { resolveWorkflowEdgeHandles } from "./ai-text-connection-utils";
import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_OUTPUT_ID,
  isAiTextAllowedReferenceNodeType,
} from "./ai-text-node-utils";
import { AI_VIDEO_OUTPUT_ID, AI_VIDEO_PROMPT_HANDLE_ID } from "./ai-video-node-utils";
import { WORKFLOW_NODE_GAP_PX } from "./workflow-node-placement";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

/** Cluster generative nodes in the same Dagre column (similar flowX). */
const GENERATIVE_COLUMN_X_CLUSTER_THRESHOLD_PX = 50;

export interface LayoutPosition {
  readonly x: number;
  readonly y: number;
}

export interface LayoutDimensions {
  readonly width: number;
  readonly height: number;
}

function snapTargetCenterYToSource(
  positions: Map<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  sourceId: string,
  targetId: string
): void {
  const sourcePos = positions.get(sourceId);
  const targetPos = positions.get(targetId);
  const sourceDim = dimensions.get(sourceId);
  const targetDim = dimensions.get(targetId);
  if (!sourcePos || !targetPos || !sourceDim || !targetDim) return;

  const sourceCenterY = sourcePos.y + sourceDim.height / 2;
  positions.set(targetId, {
    ...targetPos,
    y: sourceCenterY - targetDim.height / 2,
  });
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
  readonly height: number;
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
      height: dimension.height,
    });
  }

  items.sort((a, b) => a.x - b.x || a.y - b.y);

  const clusters: ColumnLayoutNode[][] = [];
  for (const item of items) {
    const cluster = clusters.find((candidate) => {
      const anchorX = candidate[0]?.x ?? item.x;
      return (
        Math.abs(anchorX - item.x) <= GENERATIVE_COLUMN_X_CLUSTER_THRESHOLD_PX
      );
    });
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
      const upper = cluster[index];
      const lower = cluster[index + 1];
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
 * Dagre postprocess: centerY snap, then same-column vertical gap (push up).
 */
export function applyWorkflowLayoutPostprocess(
  positions: Map<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[],
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>
): void {
  snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);
  enforceGenerativeColumnGapPushUp(positions, dimensions, nodesById);
}

/**
 * After Dagre: align anchor center Y on prompt + keywords flow edges only.
 * Pass 1 — keywords (media/text → ai-text): move text target.
 * Pass 2 — prompt (ai-text → image/video): move media target.
 *
 * Fan-in / fan-out groups are skipped so Dagre Y spacing is preserved.
 */
export function snapGenerativeFlowEdgeCenterY(
  positions: Map<string, LayoutPosition>,
  dimensions: ReadonlyMap<string, LayoutDimensions>,
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[],
  nodesById: ReadonlyMap<string, ReactFlowNode<WorkflowNodeType>>
): void {
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
    if ((keywordsBySource.get(edge.source)?.length ?? 0) > 1) continue;
    if ((keywordsByTarget.get(edge.target)?.length ?? 0) > 1) continue;
    snapTargetCenterYToSource(positions, dimensions, edge.source, edge.target);
  }

  const promptEdges = edges
    .filter((edge) => isAiTextToMediaPromptEdge(edge, nodesById))
    .filter((edge) => isForwardEdge(positions, edge.source, edge.target));

  for (const group of groupEdgesByKey(promptEdges, (edge) => edge.source).values()) {
    if (group.length !== 1) continue;
    const edge = group[0];
    snapTargetCenterYToSource(positions, dimensions, edge.source, edge.target);
  }
}
