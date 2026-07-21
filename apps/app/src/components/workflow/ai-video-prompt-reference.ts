import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  type ObjectReference,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { AI_TEXT_OUTPUT_ID } from "./ai-text-node-utils";
import {
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
} from "./ai-video-node-utils";
import {
  collectGenerativeReferenceChips,
  type GenerativeReferenceChip,
} from "./generative-reference-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface AiVideoPromptReferenceEdge {
  readonly edgeId: string;
  readonly sourceNodeId: string;
  readonly label: string;
}

function readTextFromSource(data: WorkflowNodeType): string {
  const output = data.outputs?.find((entry) => entry.id === AI_TEXT_OUTPUT_ID);
  if (typeof output?.value === "string" && output.value.trim()) {
    return output.value.trim();
  }

  const resultInput = data.inputs?.find((entry) => entry.id === "result");
  if (typeof resultInput?.value === "string" && resultInput.value.trim()) {
    return resultInput.value.trim();
  }

  return "";
}

/** Live prompt text from connected AI text output(s), joined by newline. */
export function resolveAiVideoReferencedPrompt(params: {
  readonly nodeId: string;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "id" | "source" | "target" | "targetHandle"
  >[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): string {
  const parts: string[] = [];

  for (const edge of params.edges) {
    if (
      edge.target !== params.nodeId ||
      edge.targetHandle !== AI_VIDEO_PROMPT_HANDLE_ID
    ) {
      continue;
    }

    const source = params.nodes.find((node) => node.id === edge.source);
    if (!source || source.data.nodeType !== AI_TEXT_NODE_TYPE) continue;

    const text = readTextFromSource(source.data);
    if (text) parts.push(text);
  }

  return parts.join("\n");
}

export function listAiVideoPromptReferenceEdges(params: {
  readonly nodeId: string;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "id" | "source" | "target" | "targetHandle"
  >[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): readonly AiVideoPromptReferenceEdge[] {
  return params.edges.flatMap((edge) => {
    if (
      edge.target !== params.nodeId ||
      edge.targetHandle !== AI_VIDEO_PROMPT_HANDLE_ID
    ) {
      return [];
    }

    const source = params.nodes.find((node) => node.id === edge.source);
    if (!source || source.data.nodeType !== AI_TEXT_NODE_TYPE) return [];

    return [
      {
        edgeId: edge.id,
        sourceNodeId: edge.source,
        label: source.data.name || edge.source,
      },
    ];
  });
}

export function hasAiVideoPromptReference(params: {
  readonly nodeId: string;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "target" | "targetHandle"
  >[];
}): boolean {
  return params.edges.some(
    (edge) =>
      edge.target === params.nodeId &&
      edge.targetHandle === AI_VIDEO_PROMPT_HANDLE_ID
  );
}

export function listPickableAiVideoPromptSources(params: {
  readonly targetNodeId: string;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "targetHandle"
  >[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): readonly { readonly nodeId: string; readonly sourceHandle: string }[] {
  const results: { nodeId: string; sourceHandle: string }[] = [];

  for (const node of params.nodes) {
    if (node.id === params.targetNodeId) continue;
    if (node.data.nodeType !== AI_TEXT_NODE_TYPE) continue;

    const alreadyConnected = params.edges.some(
      (edge) =>
        edge.source === node.id &&
        edge.target === params.targetNodeId &&
        edge.targetHandle === AI_VIDEO_PROMPT_HANDLE_ID
    );
    if (alreadyConnected) continue;

    const hasPromptRef = params.edges.some(
      (edge) =>
        edge.target === params.targetNodeId &&
        edge.targetHandle === AI_VIDEO_PROMPT_HANDLE_ID
    );
    if (hasPromptRef) continue;

    results.push({ nodeId: node.id, sourceHandle: AI_TEXT_OUTPUT_ID });
  }

  return results;
}

export function evaluateAiVideoPromptReferenceStructural(params: {
  readonly targetNodeId: string;
  readonly sourceNodeId: string;
  readonly sourceNodeType: string | undefined;
  readonly edges?: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "targetHandle"
  >[];
}): { readonly ok: boolean } {
  if (params.sourceNodeId === params.targetNodeId) {
    return { ok: false };
  }
  if (params.sourceNodeType !== AI_TEXT_NODE_TYPE) {
    return { ok: false };
  }
  if (
    params.edges?.some(
      (edge) =>
        edge.target === params.targetNodeId &&
        edge.targetHandle === AI_VIDEO_PROMPT_HANDLE_ID &&
        edge.source !== params.sourceNodeId
    )
  ) {
    return { ok: false };
  }
  return { ok: true };
}

/** Prompt text + image refs shown together in the bottom panel reference bar. */
export function collectAiVideoUnifiedReferenceChips(params: {
  readonly nodeId: string;
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly createObjectUrl?: (objectReference: ObjectReference) => string;
}): readonly GenerativeReferenceChip[] {
  const promptChips = collectGenerativeReferenceChips({
    nodeId: params.nodeId,
    targetHandle: AI_VIDEO_PROMPT_HANDLE_ID,
    edges: params.edges,
    nodes: params.nodes,
    createObjectUrl: params.createObjectUrl,
    classifyKind: () => "text",
  });
  const imageChips = collectGenerativeReferenceChips({
    nodeId: params.nodeId,
    targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
    edges: params.edges,
    nodes: params.nodes,
    createObjectUrl: params.createObjectUrl,
    classifyKind: (nodeType) =>
      nodeType === AI_IMAGE_NODE_TYPE ? "image" : null,
  });
  return [...promptChips, ...imageChips];
}

/** Canvas card drop: AI text output → AI video prompt (unified left handle). */
export function buildAiVideoPromptReferenceConnectionFromCardDrop(params: {
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
  if (params.dragFromHandle.type !== "source") return null;

  const sourceNode = params.nodes.find(
    (node) => node.id === params.dragFromNodeId
  );
  const targetNode = params.nodes.find(
    (node) => node.id === params.hoveredNodeId
  );
  if (sourceNode?.data.nodeType !== AI_TEXT_NODE_TYPE) return null;
  if (targetNode?.data.nodeType !== AI_VIDEO_NODE_TYPE) return null;

  return {
    source: params.dragFromNodeId,
    sourceHandle: params.dragFromHandle.id ?? AI_TEXT_OUTPUT_ID,
    target: params.hoveredNodeId,
    targetHandle: AI_VIDEO_PROMPT_HANDLE_ID,
  };
}

export function isAiVideoPromptReferenceTarget(
  nodeType: string | undefined,
  handleId: string | null | undefined
): boolean {
  return nodeType === AI_VIDEO_NODE_TYPE && handleId === AI_VIDEO_PROMPT_HANDLE_ID;
}
