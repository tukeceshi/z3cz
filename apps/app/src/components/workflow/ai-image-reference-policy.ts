import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  DEFAULT_IMAGE_MODEL_PARAMETER_RULES,
  normalizeImageModelParameterRules,
  type ImageModelParameterRules,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import {
  AI_IMAGE_OUTPUT_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
  countAiImageReferences,
  isAiImageAllowedReferenceNodeType,
  isAiImageReferenceTarget,
  referencesFitImageModelLimits,
} from "./ai-image-node-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export type AiImageReferenceRejectReason =
  | "unsupported_source"
  | "self_connection"
  | "image_limit";

export interface AiImageReferenceVerdict {
  readonly ok: boolean;
  readonly reason?: AiImageReferenceRejectReason;
  readonly phase: "structural";
}

export interface AiImageReferenceModelOption {
  readonly canonicalId: string;
  readonly parameterRules: ImageModelParameterRules;
}

export interface AiImageReferenceContext {
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
  readonly models?: readonly AiImageReferenceModelOption[];
}

function readModelId(targetNodeData: WorkflowNodeType): string | undefined {
  const value = targetNodeData.inputs?.find((input) => input.id === "model")
    ?.value;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function resolveAiImageReferenceRules(params: {
  readonly targetNodeData: WorkflowNodeType;
  readonly models?: readonly AiImageReferenceModelOption[];
}): ImageModelParameterRules {
  const modelId = readModelId(params.targetNodeData);
  if (modelId && params.models) {
    const selected = params.models.find(
      (entry) => entry.canonicalId === modelId
    );
    if (selected) {
      return normalizeImageModelParameterRules(selected.parameterRules);
    }
  }

  return DEFAULT_IMAGE_MODEL_PARAMETER_RULES;
}

/** Count / limit check for panel pick lists (no target edge context). */
export function canAcceptAiImageReference(params: {
  readonly rules: ImageModelParameterRules;
  readonly currentCount: number;
}): { readonly ok: boolean } {
  const rules = normalizeImageModelParameterRules(params.rules);
  if (params.currentCount >= rules.maxReferenceImages) {
    return { ok: false };
  }
  return { ok: true };
}

export function evaluateAiImageReferenceStructural(
  context: AiImageReferenceContext
): AiImageReferenceVerdict {
  if (context.sourceNodeId === context.targetNodeId) {
    return { ok: false, reason: "self_connection", phase: "structural" };
  }

  if (
    context.sourceHandle !== AI_IMAGE_OUTPUT_ID ||
    !isAiImageAllowedReferenceNodeType(context.sourceNodeType)
  ) {
    return { ok: false, reason: "unsupported_source", phase: "structural" };
  }

  const rules = resolveAiImageReferenceRules({
    targetNodeData: context.targetNodeData,
    models: context.models,
  });

  const existing = countAiImageReferences(context.targetNodeId, context.edges);
  const isReplacement = context.edges.some(
    (edge) =>
      edge.source === context.sourceNodeId &&
      edge.target === context.targetNodeId &&
      edge.targetHandle === AI_IMAGE_REFERENCE_HANDLE_ID
  );
  const nextCount = isReplacement ? existing : existing + 1;

  if (!referencesFitImageModelLimits(nextCount, rules)) {
    return { ok: false, reason: "image_limit", phase: "structural" };
  }

  return { ok: true, phase: "structural" };
}

export function listPickableAiImageReferenceSources(params: {
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
  readonly models?: readonly AiImageReferenceModelOption[];
}): readonly { readonly nodeId: string; readonly sourceHandle: string }[] {
  const results: { nodeId: string; sourceHandle: string }[] = [];

  for (const node of params.nodes) {
    if (node.id === params.targetNodeId) continue;
    if (!isAiImageAllowedReferenceNodeType(node.data.nodeType)) continue;

    const verdict = evaluateAiImageReferenceStructural({
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
        edge.targetHandle === AI_IMAGE_REFERENCE_HANDLE_ID
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
export function isIncomingAiImageReferenceConnection(
  connection: FlowConnectionLike
): boolean {
  if (!connection.fromNode) return false;
  const fromHandle = connection.fromHandle;
  const isSourceDrag =
    fromHandle?.type === "source" || fromHandle?.id === AI_IMAGE_OUTPUT_ID;
  if (!isSourceDrag) return false;

  const fromType = (connection.fromNode.data as WorkflowNodeType | undefined)
    ?.nodeType;
  return isAiImageAllowedReferenceNodeType(fromType);
}

/** Whole-card drop while dragging a reference onto / from AI image. */
export function buildAiImageReferenceConnectionFromCardDrop(params: {
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
    if (targetNode?.data.nodeType !== AI_IMAGE_NODE_TYPE) return null;
    if (sourceNode?.data.nodeType === AI_TEXT_NODE_TYPE) return null;
    return {
      source: params.dragFromNodeId,
      sourceHandle: params.dragFromHandle.id ?? AI_IMAGE_OUTPUT_ID,
      target: params.hoveredNodeId,
      targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
    };
  }

  return null;
}

export { isAiImageReferenceTarget };
