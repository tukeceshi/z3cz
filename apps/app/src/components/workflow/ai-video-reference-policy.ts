import {
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
  normalizeVideoModelParameterRules,
  type VideoModelParameterRules,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { AI_IMAGE_OUTPUT_ID } from "./ai-image-node-utils";
import {
  AI_VIDEO_REFERENCE_HANDLE_ID,
  countAiVideoReferences,
  isAiVideoAllowedReferenceNodeType,
  isAiVideoReferenceTarget,
  referencesFitVideoModelLimits,
} from "./ai-video-node-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export type AiVideoReferenceRejectReason =
  | "unsupported_source"
  | "self_connection"
  | "image_limit";

export interface AiVideoReferenceVerdict {
  readonly ok: boolean;
  readonly reason?: AiVideoReferenceRejectReason;
  readonly phase: "structural";
}

export interface AiVideoReferenceModelOption {
  readonly canonicalId: string;
  readonly parameterRules: VideoModelParameterRules;
}

export interface AiVideoReferenceContext {
  readonly targetNodeId: string;
  readonly sourceNodeId: string;
  readonly sourceHandle?: string | null;
  readonly sourceNodeType: string | undefined;
  readonly targetNodeData: WorkflowNodeType;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "sourceHandle" | "targetHandle"
  >[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
  readonly models?: readonly AiVideoReferenceModelOption[];
}

function readModelId(targetNodeData: WorkflowNodeType): string | undefined {
  const value = targetNodeData.inputs?.find((input) => input.id === "model")
    ?.value;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function resolveAiVideoReferenceRules(params: {
  readonly targetNodeData: WorkflowNodeType;
  readonly models?: readonly AiVideoReferenceModelOption[];
}): VideoModelParameterRules {
  const modelId = readModelId(params.targetNodeData);
  if (modelId && params.models) {
    const selected = params.models.find(
      (entry) => entry.canonicalId === modelId
    );
    if (selected) {
      return normalizeVideoModelParameterRules(selected.parameterRules);
    }
  }

  return DEFAULT_VIDEO_MODEL_PARAMETER_RULES;
}

/** Count / limit check for panel pick lists (no target edge context). */
export function canAcceptAiVideoReference(params: {
  readonly rules: VideoModelParameterRules;
  readonly currentCount: number;
}): { readonly ok: boolean } {
  const rules = normalizeVideoModelParameterRules(params.rules);
  if (params.currentCount >= rules.maxReferenceImages) {
    return { ok: false };
  }
  return { ok: true };
}

export function evaluateAiVideoReferenceStructural(
  context: AiVideoReferenceContext
): AiVideoReferenceVerdict {
  if (context.sourceNodeId === context.targetNodeId) {
    return { ok: false, reason: "self_connection", phase: "structural" };
  }

  if (
    context.sourceHandle !== AI_IMAGE_OUTPUT_ID ||
    !isAiVideoAllowedReferenceNodeType(context.sourceNodeType)
  ) {
    return { ok: false, reason: "unsupported_source", phase: "structural" };
  }

  const rules = resolveAiVideoReferenceRules({
    targetNodeData: context.targetNodeData,
    models: context.models,
  });

  const existing = countAiVideoReferences(context.targetNodeId, context.edges);
  const isReplacement = context.edges.some(
    (edge) =>
      edge.source === context.sourceNodeId &&
      edge.target === context.targetNodeId &&
      edge.targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID
  );
  const nextCount = isReplacement ? existing : existing + 1;

  if (!referencesFitVideoModelLimits(nextCount, rules)) {
    return { ok: false, reason: "image_limit", phase: "structural" };
  }

  return { ok: true, phase: "structural" };
}

export function listPickableAiVideoReferenceSources(params: {
  readonly targetNodeId: string;
  readonly targetNodeData: WorkflowNodeType;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "sourceHandle" | "targetHandle"
  >[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
  readonly models?: readonly AiVideoReferenceModelOption[];
}): readonly { readonly nodeId: string; readonly sourceHandle: string }[] {
  const results: { nodeId: string; sourceHandle: string }[] = [];

  for (const node of params.nodes) {
    if (node.id === params.targetNodeId) continue;
    if (!isAiVideoAllowedReferenceNodeType(node.data.nodeType)) continue;

    const verdict = evaluateAiVideoReferenceStructural({
      targetNodeId: params.targetNodeId,
      sourceNodeId: node.id,
      sourceHandle: AI_IMAGE_OUTPUT_ID,
      sourceNodeType: node.data.nodeType,
      targetNodeData: params.targetNodeData,
      edges: params.edges,
      nodes: params.nodes,
      models: params.models,
    });
    if (!verdict.ok) continue;

    const alreadyConnected = params.edges.some(
      (edge) =>
        edge.source === node.id &&
        edge.target === params.targetNodeId &&
        edge.targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID
    );
    if (alreadyConnected) continue;

    results.push({ nodeId: node.id, sourceHandle: AI_IMAGE_OUTPUT_ID });
  }

  return results;
}

interface FlowConnectionLike {
  readonly fromNode: { readonly id: string; readonly data: unknown } | null;
  readonly fromHandle: {
    readonly type: string;
    readonly id?: string | null;
  } | null;
}

/** Canvas drag: image output from an AI image node into a reference slot. */
export function isIncomingAiVideoReferenceConnection(
  connection: FlowConnectionLike
): boolean {
  if (!connection.fromNode) return false;
  const fromHandle = connection.fromHandle;
  const isSourceDrag =
    fromHandle?.type === "source" || fromHandle?.id === AI_IMAGE_OUTPUT_ID;
  if (!isSourceDrag) return false;

  const fromType = (connection.fromNode.data as WorkflowNodeType | undefined)
    ?.nodeType;
  return isAiVideoAllowedReferenceNodeType(fromType);
}

/** Whole-card drop while dragging a reference onto / from AI video. */
export function buildAiVideoReferenceConnectionFromCardDrop(params: {
  readonly dragFromNodeId: string;
  readonly dragFromHandle: {
    readonly type: string;
    readonly id?: string | null;
  } | null;
  readonly hoveredNodeId: string;
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): {
  readonly source: string;
  readonly sourceHandle: string;
  readonly target: string;
  readonly targetHandle: string;
} | null {
  if (!params.dragFromHandle) return null;
  if (params.hoveredNodeId === params.dragFromNodeId) return null;

  if (params.dragFromHandle.type === "source") {
    const sourceNode = params.nodes.find(
      (node) => node.id === params.dragFromNodeId
    );
    const targetNode = params.nodes.find(
      (node) => node.id === params.hoveredNodeId
    );
    if (targetNode?.data.nodeType !== AI_VIDEO_NODE_TYPE) return null;
    if (sourceNode?.data.nodeType === AI_TEXT_NODE_TYPE) return null;
    return {
      source: params.dragFromNodeId,
      sourceHandle: params.dragFromHandle.id ?? AI_IMAGE_OUTPUT_ID,
      target: params.hoveredNodeId,
      targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
    };
  }

  return null;
}

export { isAiVideoReferenceTarget };
