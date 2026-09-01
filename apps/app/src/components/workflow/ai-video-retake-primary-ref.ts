import {
  readAiVideoRetakeDraftFromInputs,
  type AiVideoRetakeDraft,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import {
  AI_VIDEO_REFERENCE_HANDLE_ID,
  classifyAiVideoReferenceFromNodeType,
} from "./ai-video-node-utils";
import {
  collectGenerativeReferenceChips,
  resolveReferenceMediaFromSource,
  type GenerativeReferenceChip,
} from "./generative-reference-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface RetakePrimaryVideoRef {
  readonly edgeId: string;
  readonly sourceNodeId: string;
  readonly media: WorkflowMediaValue;
}

type FlowEdgeRef = Pick<
  ReactFlowEdge<WorkflowEdgeType>,
  "id" | "source" | "target" | "sourceHandle" | "targetHandle"
>;

type FlowNodeRef = Pick<ReactFlowNode<WorkflowNodeType>, "id" | "data">;

function resolveVideoMediaFromEdge(params: {
  readonly edge: FlowEdgeRef;
  readonly nodes: readonly FlowNodeRef[];
}): WorkflowMediaValue | undefined {
  const sourceNode = params.nodes.find((node) => node.id === params.edge.source);
  if (!sourceNode) {
    return undefined;
  }
  const sourceData = sourceNode.data;
  const kind = classifyAiVideoReferenceFromNodeType(sourceData.nodeType);
  if (kind !== "video") {
    return undefined;
  }
  const output = sourceData.outputs?.find(
    (entry) => entry.id === params.edge.sourceHandle
  );
  return resolveReferenceMediaFromSource({
    kind: "video",
    sourceData,
    outputValue: output?.value,
  });
}

function findFirstVideoReferenceChip(params: {
  readonly targetNodeId: string;
  readonly edges: readonly FlowEdgeRef[];
  readonly nodes: readonly FlowNodeRef[];
}): GenerativeReferenceChip | null {
  const chips = collectGenerativeReferenceChips({
    nodeId: params.targetNodeId,
    targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
    edges: params.edges,
    nodes: params.nodes,
    classifyKind: (nodeType) => classifyAiVideoReferenceFromNodeType(nodeType),
  });
  return chips.find((chip) => chip.kind === "video") ?? null;
}

export function resolveRetakePrimaryVideoRef(params: {
  readonly targetNodeId: string;
  readonly edges: readonly FlowEdgeRef[];
  readonly nodes: readonly FlowNodeRef[];
  readonly draft?: AiVideoRetakeDraft;
  readonly inputs?: readonly { readonly id: string; readonly value?: unknown }[];
}): RetakePrimaryVideoRef | null {
  const draft =
    params.draft ??
    (params.inputs ? readAiVideoRetakeDraftFromInputs(params.inputs) : null);

  if (draft?.primaryVideoEdgeId) {
    const edge = params.edges.find(
      (entry) => entry.id === draft.primaryVideoEdgeId
    );
    if (
      edge &&
      edge.target === params.targetNodeId &&
      edge.targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID
    ) {
      const media = resolveVideoMediaFromEdge({ edge, nodes: params.nodes });
      if (media) {
        return {
          edgeId: edge.id,
          sourceNodeId: edge.source,
          media,
        };
      }
    }
  }

  const fallback = findFirstVideoReferenceChip(params);
  if (!fallback?.media) {
    return null;
  }
  return {
    edgeId: fallback.edgeId,
    sourceNodeId: fallback.sourceNodeId,
    media: fallback.media,
  };
}

export function isRetakePrimaryVideoEdge(params: {
  readonly edgeId: string;
  readonly targetNodeId: string;
  readonly edges: readonly FlowEdgeRef[];
  readonly nodes: readonly FlowNodeRef[];
  readonly inputs?: readonly { readonly id: string; readonly value?: unknown }[];
}): boolean {
  const primary = resolveRetakePrimaryVideoRef({
    targetNodeId: params.targetNodeId,
    edges: params.edges,
    nodes: params.nodes,
    inputs: params.inputs,
  });
  return primary?.edgeId === params.edgeId;
}

export function annotateRetakePrimaryVideoChips(params: {
  readonly chips: readonly GenerativeReferenceChip[];
  readonly primaryEdgeId: string | null;
  readonly sourceLabel: string;
}): readonly GenerativeReferenceChip[] {
  if (!params.primaryEdgeId) {
    return params.chips;
  }
  return params.chips.map((chip) =>
    chip.edgeId === params.primaryEdgeId
      ? {
          ...chip,
          overlayLabel: params.sourceLabel,
          disconnectable: false,
        }
      : chip
  );
}

export function collectRetakeSupplementalVideoMedia(params: {
  readonly targetNodeId: string;
  readonly edges: readonly FlowEdgeRef[];
  readonly nodes: readonly FlowNodeRef[];
  readonly inputs?: readonly { readonly id: string; readonly value?: unknown }[];
}): readonly WorkflowMediaValue[] {
  const primaryEdgeId =
    resolveRetakePrimaryVideoRef(params)?.edgeId ?? null;
  const chips = collectGenerativeReferenceChips({
    nodeId: params.targetNodeId,
    targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
    edges: params.edges,
    nodes: params.nodes,
    classifyKind: (nodeType) => classifyAiVideoReferenceFromNodeType(nodeType),
  });
  return chips
    .filter(
      (chip) =>
        chip.kind === "video" &&
        chip.media &&
        chip.edgeId !== primaryEdgeId
    )
    .map((chip) => chip.media!);
}

export function collectRetakeSupplementalReferenceMedia(params: {
  readonly targetNodeId: string;
  readonly edges: readonly FlowEdgeRef[];
  readonly nodes: readonly FlowNodeRef[];
  readonly inputs?: readonly { readonly id: string; readonly value?: unknown }[];
}): readonly WorkflowMediaValue[] {
  const primaryEdgeId =
    resolveRetakePrimaryVideoRef(params)?.edgeId ?? null;
  const chips = collectGenerativeReferenceChips({
    nodeId: params.targetNodeId,
    targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
    edges: params.edges,
    nodes: params.nodes,
    classifyKind: (nodeType) => classifyAiVideoReferenceFromNodeType(nodeType),
  });
  return chips
    .filter((chip) => chip.media && chip.edgeId !== primaryEdgeId)
    .map((chip) => chip.media!);
}
