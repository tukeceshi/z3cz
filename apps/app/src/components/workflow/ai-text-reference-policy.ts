import {
  AI_TEXT_NODE_TYPE,
  DEFAULT_TEXT_MODEL_PARAMETER_RULES,
  normalizeTextModelParameterRules,
  type TextModelParameterRules,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_OUTPUT_ID,
  classifyReferenceFromNodeType,
  isAiTextAllowedReferenceNodeType,
  type AiTextReferenceCounts,
  type AiTextReferenceKind,
} from "./ai-text-node-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";
import { readTextReferenceLimitsFromMetadata } from "./generative-reference-metadata";

export type AiTextReferenceRejectReason =
  | "unsupported_source"
  | "self_connection"
  | "text_limit"
  | "image_limit"
  | "video_limit";

export interface AiTextReferenceVerdict {
  readonly ok: boolean;
  readonly reason?: AiTextReferenceRejectReason;
  readonly phase: "structural";
}

export interface AiTextReferenceModelOption {
  readonly canonicalId: string;
  readonly parameterRules: TextModelParameterRules;
}

export interface AiTextReferenceContext {
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
  readonly models?: readonly AiTextReferenceModelOption[];
}

interface FlowConnectionLike {
  readonly fromNode: { readonly id: string; readonly data: unknown } | null;
  readonly fromHandle: {
    readonly type: string;
    readonly id?: string | null;
  } | null;
}

function readModelId(targetNodeData: WorkflowNodeType): string | undefined {
  const value = targetNodeData.inputs?.find((input) => input.id === "model")
    ?.value;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Resolve reference limits from live model catalog, else synced metadata, else defaults. */
export function resolveAiTextReferenceRules(params: {
  readonly targetNodeData: WorkflowNodeType;
  readonly models?: readonly AiTextReferenceModelOption[];
}): TextModelParameterRules {
  const modelId = readModelId(params.targetNodeData);
  if (modelId && params.models) {
    const selected = params.models.find(
      (entry) => entry.canonicalId === modelId
    );
    if (selected) {
      return normalizeTextModelParameterRules(selected.parameterRules);
    }
  }

  const meta = params.targetNodeData.metadata ?? {};
  if (
    meta.refMaxText !== undefined ||
    meta.refMaxImage !== undefined ||
    meta.refMaxVideo !== undefined
  ) {
    const limits = readTextReferenceLimitsFromMetadata(
      meta,
      DEFAULT_TEXT_MODEL_PARAMETER_RULES
    );
    return normalizeTextModelParameterRules({
      ...DEFAULT_TEXT_MODEL_PARAMETER_RULES,
      ...limits,
    });
  }

  return DEFAULT_TEXT_MODEL_PARAMETER_RULES;
}

export function countAiTextReferences(
  targetNodeId: string,
  edges: AiTextReferenceContext["edges"],
  nodes: AiTextReferenceContext["nodes"]
): AiTextReferenceCounts {
  let text = 0;
  let image = 0;
  let video = 0;

  for (const edge of edges) {
    if (
      edge.target !== targetNodeId ||
      edge.targetHandle !== AI_TEXT_KEYWORDS_HANDLE_ID
    ) {
      continue;
    }
    const source = nodes.find((node) => node.id === edge.source);
    const kind = classifyReferenceFromNodeType(source?.data.nodeType);
    if (kind === "text") text += 1;
    else if (kind === "image") image += 1;
    else if (kind === "video") video += 1;
  }

  return { text, image, video };
}

export function preferredSourceHandle(
  kind: AiTextReferenceKind
): string {
  if (kind === "text") return "text";
  if (kind === "image") return "images";
  return "videos";
}

function canAcceptOneMoreReference(params: {
  readonly rules: TextModelParameterRules;
  readonly sourceNodeType: string | undefined;
  readonly currentCounts: AiTextReferenceCounts;
}): AiTextReferenceVerdict {
  const kind = classifyReferenceFromNodeType(params.sourceNodeType);
  if (!kind || !isAiTextAllowedReferenceNodeType(params.sourceNodeType)) {
    return { ok: false, reason: "unsupported_source", phase: "structural" };
  }

  const rules = normalizeTextModelParameterRules(params.rules);

  if (kind === "text" && params.currentCounts.text >= rules.maxTextReferences) {
    return { ok: false, reason: "text_limit", phase: "structural" };
  }
  if (
    kind === "image" &&
    params.currentCounts.image >= rules.maxImageReferences
  ) {
    return { ok: false, reason: "image_limit", phase: "structural" };
  }
  if (
    kind === "video" &&
    params.currentCounts.video >= rules.maxVideoReferences
  ) {
    return { ok: false, reason: "video_limit", phase: "structural" };
  }

  return { ok: true, phase: "structural" };
}

/** Count / limit check for panel pick lists (no target edge context). */
export function canAcceptAiTextReference(params: {
  readonly rules: TextModelParameterRules;
  readonly sourceNodeType: string | undefined;
  readonly currentCounts: AiTextReferenceCounts;
}): { readonly ok: boolean; readonly reason?: string } {
  const verdict = canAcceptOneMoreReference(params);
  return { ok: verdict.ok, reason: verdict.reason };
}

/** Structural reference check — shared by canvas connect, highlight, and panel pick. */
export function evaluateAiTextReferenceStructural(
  ctx: AiTextReferenceContext
): AiTextReferenceVerdict {
  if (ctx.sourceNodeId === ctx.targetNodeId) {
    return { ok: false, reason: "self_connection", phase: "structural" };
  }

  const rules = resolveAiTextReferenceRules({
    targetNodeData: ctx.targetNodeData,
    models: ctx.models,
  });
  const currentCounts = countAiTextReferences(
    ctx.targetNodeId,
    ctx.edges,
    ctx.nodes
  );

  return canAcceptOneMoreReference({
    rules,
    sourceNodeType: ctx.sourceNodeType,
    currentCounts,
  });
}

export interface PickableReferenceSource {
  readonly nodeId: string;
  readonly nodeName: string;
  readonly outputId: string;
  readonly outputName: string;
  readonly kind: AiTextReferenceKind;
}

export function listPickableReferenceSources(
  ctx: Omit<
    AiTextReferenceContext,
    "sourceNodeId" | "sourceHandle" | "sourceNodeType"
  >
): readonly PickableReferenceSource[] {
  const rules = resolveAiTextReferenceRules({
    targetNodeData: ctx.targetNodeData,
    models: ctx.models,
  });
  const currentCounts = countAiTextReferences(
    ctx.targetNodeId,
    ctx.edges,
    ctx.nodes
  );

  return ctx.nodes.flatMap((node) => {
    if (node.id === ctx.targetNodeId) return [];
    const sourceData = node.data;
    const kind = classifyReferenceFromNodeType(sourceData.nodeType);
    if (!kind) return [];

    const check = canAcceptOneMoreReference({
      rules,
      sourceNodeType: sourceData.nodeType,
      currentCounts,
    });
    if (!check.ok) return [];

    const preferredHandle = preferredSourceHandle(kind);
    const output =
      sourceData.outputs?.find((entry) => entry.id === preferredHandle) ??
      sourceData.outputs?.[0];
    if (!output) return [];

    return [
      {
        nodeId: node.id,
        nodeName: sourceData.name,
        outputId: output.id,
        outputName: output.name,
        kind,
      },
    ];
  });
}

/** Canvas drag: allowed source handle + node type for an incoming AI text reference. */
export function isIncomingAiTextReferenceConnection(
  connection: FlowConnectionLike
): boolean {
  if (!connection.fromNode) return false;
  const fromHandle = connection.fromHandle;
  const isSourceDrag =
    fromHandle?.type === "source" || fromHandle?.id === AI_TEXT_OUTPUT_ID;
  if (!isSourceDrag) return false;

  const fromType = (connection.fromNode.data as WorkflowNodeType | undefined)
    ?.nodeType;
  return (
    fromType !== undefined && isAiTextAllowedReferenceNodeType(fromType)
  );
}

/** Dragging from AI text keywords handle to pick a reference source. */
export function isOutboundAiTextReferencePick(
  connection: FlowConnectionLike
): boolean {
  if (!connection.fromNode) return false;
  const fromHandle = connection.fromHandle;
  if (
    fromHandle?.type !== "target" ||
    fromHandle.id !== AI_TEXT_KEYWORDS_HANDLE_ID
  ) {
    return false;
  }
  return (
    (connection.fromNode.data as WorkflowNodeType | undefined)?.nodeType ===
    AI_TEXT_NODE_TYPE
  );
}

export function isIncomingAiTextReferenceAllowed(params: {
  readonly connection: FlowConnectionLike;
  readonly targetNodeId: string;
  readonly targetNodeData: WorkflowNodeType;
  readonly edges: AiTextReferenceContext["edges"];
  readonly nodes: AiTextReferenceContext["nodes"];
  readonly models?: readonly AiTextReferenceModelOption[];
}): boolean {
  if (!isIncomingAiTextReferenceConnection(params.connection)) return false;
  if (!params.connection.fromNode) return false;
  if (params.connection.fromNode.id === params.targetNodeId) return false;

  const verdict = evaluateAiTextReferenceStructural({
    targetNodeId: params.targetNodeId,
    sourceNodeId: params.connection.fromNode.id,
    sourceHandle: params.connection.fromHandle?.id ?? null,
    sourceNodeType: (params.connection.fromNode.data as WorkflowNodeType)
      .nodeType,
    targetNodeData: params.targetNodeData,
    edges: params.edges,
    nodes: params.nodes,
    models: params.models,
  });

  return verdict.ok;
}

export function isAiTextKeywordsTarget(
  targetNodeType: string | undefined,
  targetHandleId: string | undefined | null
): boolean {
  return (
    targetNodeType === AI_TEXT_NODE_TYPE &&
    targetHandleId === AI_TEXT_KEYWORDS_HANDLE_ID
  );
}

/** Whole-card drop while dragging a reference onto / from AI text. */
export function buildAiTextReferenceConnectionFromCardDrop(params: {
  readonly dragFromNodeId: string;
  readonly dragFromHandle: {
    readonly type: string;
    readonly id?: string | null;
  } | null;
  readonly hoveredNodeId: string;
  readonly nodes: AiTextReferenceContext["nodes"];
}): {
  readonly source: string;
  readonly sourceHandle: string;
  readonly target: string;
  readonly targetHandle: string;
} | null {
  if (!params.dragFromHandle) return null;
  if (params.hoveredNodeId === params.dragFromNodeId) return null;

  if (params.dragFromHandle.type === "source") {
    const targetNode = params.nodes.find(
      (node) => node.id === params.hoveredNodeId
    );
    if (targetNode?.data.nodeType !== AI_TEXT_NODE_TYPE) return null;
    return {
      source: params.dragFromNodeId,
      sourceHandle: params.dragFromHandle.id ?? preferredSourceHandle("text"),
      target: params.hoveredNodeId,
      targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
    };
  }

  if (
    params.dragFromHandle.type === "target" &&
    params.dragFromHandle.id === AI_TEXT_KEYWORDS_HANDLE_ID
  ) {
    const hostNode = params.nodes.find(
      (node) => node.id === params.dragFromNodeId
    );
    if (hostNode?.data.nodeType !== AI_TEXT_NODE_TYPE) return null;

    const sourceNode = params.nodes.find(
      (node) => node.id === params.hoveredNodeId
    );
    if (
      !sourceNode ||
      !isAiTextAllowedReferenceNodeType(sourceNode.data.nodeType)
    ) {
      return null;
    }
    const kind = classifyReferenceFromNodeType(sourceNode.data.nodeType);
    if (!kind) return null;

    return {
      source: params.hoveredNodeId,
      sourceHandle: preferredSourceHandle(kind),
      target: params.dragFromNodeId,
      targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
    };
  }

  return null;
}
