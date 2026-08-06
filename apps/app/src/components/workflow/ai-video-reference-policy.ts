import {
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
  normalizeVideoModelParameterRules,
  referencesFitVideoModelReferenceLimits,
  type SubmitAiVideoMediaReferenceCounts,
  type VideoModelParameterRules,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { AI_AUDIO_OUTPUT_ID } from "./ai-audio-node-utils";
import { AI_IMAGE_OUTPUT_ID } from "./ai-image-node-utils";
import {
  readVideoReferenceLimitsFromMetadata,
  REF_MAX_AUDIOS_META_KEY,
  REF_MAX_IMAGES_META_KEY,
  REF_MAX_VIDEOS_META_KEY,
} from "./generative-reference-metadata";
import {
  AI_VIDEO_OUTPUT_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
  classifyAiVideoReferenceFromNodeType,
  countAiVideoReferenceCounts,
  isAiVideoAllowedReferenceNodeType,
  isAiVideoReferenceTarget,
  type AiVideoReferenceKind,
} from "./ai-video-node-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export type AiVideoReferenceRejectReason =
  | "unsupported_source"
  | "self_connection"
  | "image_limit"
  | "video_limit"
  | "audio_limit";

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

function expectedSourceHandle(kind: AiVideoReferenceKind): string {
  if (kind === "image") return AI_IMAGE_OUTPUT_ID;
  if (kind === "video") return AI_VIDEO_OUTPUT_ID;
  return AI_AUDIO_OUTPUT_ID;
}

function maxForKind(
  rules: VideoModelParameterRules,
  kind: AiVideoReferenceKind
): number {
  const normalized = normalizeVideoModelParameterRules(rules);
  if (kind === "image") return normalized.maxReferenceImages;
  if (kind === "video") return normalized.maxReferenceVideos;
  return normalized.maxReferenceAudios;
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

  const metadata = params.targetNodeData.metadata;
  if (
    metadata?.[REF_MAX_IMAGES_META_KEY] !== undefined ||
    metadata?.[REF_MAX_VIDEOS_META_KEY] !== undefined ||
    metadata?.[REF_MAX_AUDIOS_META_KEY] !== undefined
  ) {
    const limits = readVideoReferenceLimitsFromMetadata(
      metadata,
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES
    );
    return normalizeVideoModelParameterRules({
      ...DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
      ...limits,
    });
  }

  return DEFAULT_VIDEO_MODEL_PARAMETER_RULES;
}

function referencesFitResolvedVideoLimits(
  counts: SubmitAiVideoMediaReferenceCounts,
  rules: VideoModelParameterRules
): boolean {
  return referencesFitVideoModelReferenceLimits(counts, rules);
}

/** Count / limit check for panel pick lists (no target edge context). */
export function canAcceptAiVideoReference(params: {
  readonly rules: VideoModelParameterRules;
  readonly kind: AiVideoReferenceKind;
  readonly currentCounts: SubmitAiVideoMediaReferenceCounts;
  readonly targetNodeData?: WorkflowNodeType;
}): { readonly ok: boolean } {
  const rules = normalizeVideoModelParameterRules(params.rules);
  const limit = maxForKind(rules, params.kind);
  const current =
    params.kind === "image"
      ? params.currentCounts.imageCount
      : params.kind === "video"
        ? params.currentCounts.videoCount
        : params.currentCounts.audioCount;
  if (current >= limit) {
    return { ok: false };
  }

  const nextCounts: SubmitAiVideoMediaReferenceCounts = {
    imageCount:
      params.currentCounts.imageCount + (params.kind === "image" ? 1 : 0),
    videoCount:
      params.currentCounts.videoCount + (params.kind === "video" ? 1 : 0),
    audioCount:
      params.currentCounts.audioCount + (params.kind === "audio" ? 1 : 0),
  };

  if (params.targetNodeData) {
    return {
      ok: referencesFitResolvedVideoLimits(nextCounts, rules),
    };
  }

  return { ok: true };
}

export function evaluateAiVideoReferenceStructural(
  context: AiVideoReferenceContext
): AiVideoReferenceVerdict {
  if (context.sourceNodeId === context.targetNodeId) {
    return { ok: false, reason: "self_connection", phase: "structural" };
  }

  const kind = classifyAiVideoReferenceFromNodeType(context.sourceNodeType);
  if (
    !kind ||
    context.sourceHandle !== expectedSourceHandle(kind) ||
    !isAiVideoAllowedReferenceNodeType(context.sourceNodeType)
  ) {
    return { ok: false, reason: "unsupported_source", phase: "structural" };
  }

  const rules = resolveAiVideoReferenceRules({
    targetNodeData: context.targetNodeData,
    models: context.models,
  });

  const existing = countAiVideoReferenceCounts(
    context.targetNodeId,
    context.edges,
    context.nodes.map((node) => ({ id: node.id, data: node.data }))
  );
  const isReplacement = context.edges.some(
    (edge) =>
      edge.source === context.sourceNodeId &&
      edge.target === context.targetNodeId &&
      edge.targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID
  );

  const nextCounts: SubmitAiVideoMediaReferenceCounts = isReplacement
    ? existing
    : {
        imageCount: existing.imageCount + (kind === "image" ? 1 : 0),
        videoCount: existing.videoCount + (kind === "video" ? 1 : 0),
        audioCount: existing.audioCount + (kind === "audio" ? 1 : 0),
      };

  if (!referencesFitResolvedVideoLimits(nextCounts, rules)) {
    if (kind === "image") {
      return { ok: false, reason: "image_limit", phase: "structural" };
    }
    if (kind === "video") {
      return { ok: false, reason: "video_limit", phase: "structural" };
    }
    return { ok: false, reason: "audio_limit", phase: "structural" };
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
    const kind = classifyAiVideoReferenceFromNodeType(node.data.nodeType);
    if (!kind) continue;

    const sourceHandle = expectedSourceHandle(kind);
    const verdict = evaluateAiVideoReferenceStructural({
      targetNodeId: params.targetNodeId,
      sourceNodeId: node.id,
      sourceHandle,
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

    results.push({ nodeId: node.id, sourceHandle });
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

/** Canvas drag: media output into a video reference slot. */
export function isIncomingAiVideoReferenceConnection(
  connection: FlowConnectionLike
): boolean {
  if (!connection.fromNode) return false;
  const fromHandle = connection.fromHandle;
  const fromType = (connection.fromNode.data as WorkflowNodeType | undefined)
    ?.nodeType;
  const kind = classifyAiVideoReferenceFromNodeType(fromType);
  if (!kind) return false;

  const expectedHandle = expectedSourceHandle(kind);
  const isSourceDrag =
    fromHandle?.type === "source" || fromHandle?.id === expectedHandle;
  return isSourceDrag;
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

    const kind = classifyAiVideoReferenceFromNodeType(sourceNode?.data.nodeType);
    if (!kind) return null;

    return {
      source: params.dragFromNodeId,
      sourceHandle: params.dragFromHandle.id ?? expectedSourceHandle(kind),
      target: params.hoveredNodeId,
      targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
    };
  }

  return null;
}

export { isAiVideoReferenceTarget };
