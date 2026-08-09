import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, type MediaReference } from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { AI_TEXT_OUTPUT_ID, readAiTextPromptSource } from "./ai-text-node-utils";
import {
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
} from "./ai-image-node-utils";
import {
  collectGenerativeReferenceChips,
  isGenerativeReferenceAlreadyConnected,
  type GenerativeReferenceChip,
} from "./generative-reference-utils";
import { isGenerativeManualContent } from "./generative-card-mode-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface AiImagePromptReferenceEdge {
  readonly edgeId: string;
  readonly sourceNodeId: string;
  readonly label: string;
}

function readTextFromSource(data: WorkflowNodeType): string {
  return readAiTextPromptSource(data);
}

/** Live prompt text from connected AI text output(s), joined by newline. */
export function resolveAiImageReferencedPrompt(params: {
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
      edge.targetHandle !== AI_IMAGE_PROMPT_HANDLE_ID
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

export function listAiImagePromptReferenceEdges(params: {
  readonly nodeId: string;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "id" | "source" | "target" | "targetHandle"
  >[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): readonly AiImagePromptReferenceEdge[] {
  return params.edges.flatMap((edge) => {
    if (
      edge.target !== params.nodeId ||
      edge.targetHandle !== AI_IMAGE_PROMPT_HANDLE_ID
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

export function hasAiImagePromptReference(params: {
  readonly nodeId: string;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "target" | "targetHandle"
  >[];
}): boolean {
  return params.edges.some(
    (edge) =>
      edge.target === params.nodeId &&
      edge.targetHandle === AI_IMAGE_PROMPT_HANDLE_ID
  );
}

export function listPickableAiImagePromptSources(params: {
  readonly targetNodeId: string;
  readonly targetNodeMetadata?: Record<string, string> | undefined;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "targetHandle"
  >[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): readonly { readonly nodeId: string; readonly sourceHandle: string }[] {
  if (isGenerativeManualContent(params.targetNodeMetadata)) {
    return [];
  }

  const results: { nodeId: string; sourceHandle: string }[] = [];

  for (const node of params.nodes) {
    if (node.id === params.targetNodeId) continue;
    if (node.data.nodeType !== AI_TEXT_NODE_TYPE) continue;

    const alreadyConnected = params.edges.some(
      (edge) =>
        edge.source === node.id &&
        edge.target === params.targetNodeId &&
        edge.targetHandle === AI_IMAGE_PROMPT_HANDLE_ID
    );
    if (alreadyConnected) continue;

    const hasPromptRef = params.edges.some(
      (edge) =>
        edge.target === params.targetNodeId &&
        edge.targetHandle === AI_IMAGE_PROMPT_HANDLE_ID
    );
    if (hasPromptRef) continue;

    results.push({ nodeId: node.id, sourceHandle: AI_TEXT_OUTPUT_ID });
  }

  return results;
}

export function evaluateAiImagePromptReferenceStructural(params: {
  readonly targetNodeId: string;
  readonly targetNodeMetadata?: Record<string, string> | undefined;
  readonly sourceNodeId: string;
  readonly sourceNodeType: string | undefined;
  readonly edges?: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "targetHandle"
  >[];
}): { readonly ok: boolean; readonly reason?: "already_connected" } {
  if (isGenerativeManualContent(params.targetNodeMetadata)) {
    return { ok: false };
  }
  if (params.sourceNodeId === params.targetNodeId) {
    return { ok: false };
  }
  if (params.sourceNodeType !== AI_TEXT_NODE_TYPE) {
    return { ok: false };
  }
  if (
    params.edges &&
    isGenerativeReferenceAlreadyConnected(params.edges, {
      source: params.sourceNodeId,
      target: params.targetNodeId,
      targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
    })
  ) {
    return { ok: false, reason: "already_connected" };
  }
  if (
    params.edges?.some(
      (edge) =>
        edge.target === params.targetNodeId &&
        edge.targetHandle === AI_IMAGE_PROMPT_HANDLE_ID &&
        edge.source !== params.sourceNodeId
    )
  ) {
    return { ok: false };
  }
  return { ok: true };
}

/** Prompt text + image refs shown together in the bottom panel reference bar. */
export function collectAiImageUnifiedReferenceChips(params: {
  readonly nodeId: string;
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
}): readonly GenerativeReferenceChip[] {
  const promptChips = collectGenerativeReferenceChips({
    nodeId: params.nodeId,
    targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
    edges: params.edges,
    nodes: params.nodes,
    classifyKind: () => "text",
  });
  const imageChips = collectGenerativeReferenceChips({
    nodeId: params.nodeId,
    targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
    edges: params.edges,
    nodes: params.nodes,
    classifyKind: (nodeType) =>
      nodeType === AI_IMAGE_NODE_TYPE ? "image" : null,
  });
  return [...promptChips, ...imageChips];
}

/** Canvas card drop: AI text output → AI image prompt (unified left handle). */
export function buildAiImagePromptReferenceConnectionFromCardDrop(params: {
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
  if (targetNode?.data.nodeType !== AI_IMAGE_NODE_TYPE) return null;
  if (isGenerativeManualContent(targetNode.data.metadata)) return null;

  return {
    source: params.dragFromNodeId,
    sourceHandle: params.dragFromHandle.id ?? AI_TEXT_OUTPUT_ID,
    target: params.hoveredNodeId,
    targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
  };
}

export function isAiImagePromptReferenceTarget(
  nodeType: string | undefined,
  handleId: string | null | undefined
): boolean {
  return nodeType === AI_IMAGE_NODE_TYPE && handleId === AI_IMAGE_PROMPT_HANDLE_ID;
}
