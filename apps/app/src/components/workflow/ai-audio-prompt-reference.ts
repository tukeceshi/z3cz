import {
  AI_AUDIO_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { AI_TEXT_OUTPUT_ID, readAiTextPromptSource } from "./ai-text-node-utils";
import { AI_AUDIO_PROMPT_HANDLE_ID } from "./ai-audio-node-utils";
import {
  collectGenerativeReferenceChips,
  type GenerativeReferenceChip,
} from "./generative-reference-utils";
import { isGenerativeManualContent } from "./generative-card-mode-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface AiAudioPromptReferenceEdge {
  readonly edgeId: string;
  readonly sourceNodeId: string;
  readonly label: string;
}

function readTextFromSource(data: WorkflowNodeType): string {
  return readAiTextPromptSource(data);
}

/** Live prompt text from connected AI text output(s), joined by newline. */
export function resolveAiAudioReferencedPrompt(params: {
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
      edge.targetHandle !== AI_AUDIO_PROMPT_HANDLE_ID
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

export function listAiAudioPromptReferenceEdges(params: {
  readonly nodeId: string;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "id" | "source" | "target" | "targetHandle"
  >[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): readonly AiAudioPromptReferenceEdge[] {
  return params.edges.flatMap((edge) => {
    if (
      edge.target !== params.nodeId ||
      edge.targetHandle !== AI_AUDIO_PROMPT_HANDLE_ID
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

export function hasAiAudioPromptReference(params: {
  readonly nodeId: string;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "target" | "targetHandle"
  >[];
}): boolean {
  return params.edges.some(
    (edge) =>
      edge.target === params.nodeId &&
      edge.targetHandle === AI_AUDIO_PROMPT_HANDLE_ID
  );
}

export function listPickableAiAudioPromptSources(params: {
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
        edge.targetHandle === AI_AUDIO_PROMPT_HANDLE_ID
    );
    if (alreadyConnected) continue;

    const hasPromptRef = params.edges.some(
      (edge) =>
        edge.target === params.targetNodeId &&
        edge.targetHandle === AI_AUDIO_PROMPT_HANDLE_ID
    );
    if (hasPromptRef) continue;

    results.push({ nodeId: node.id, sourceHandle: AI_TEXT_OUTPUT_ID });
  }

  return results;
}

export function evaluateAiAudioPromptReferenceStructural(params: {
  readonly targetNodeId: string;
  readonly targetNodeMetadata?: Record<string, string> | undefined;
  readonly sourceNodeId: string;
  readonly sourceNodeType: string | undefined;
  readonly edges?: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "targetHandle"
  >[];
}): { readonly ok: boolean } {
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
    params.edges?.some(
      (edge) =>
        edge.target === params.targetNodeId &&
        edge.targetHandle === AI_AUDIO_PROMPT_HANDLE_ID &&
        edge.source !== params.sourceNodeId
    )
  ) {
    return { ok: false };
  }
  return { ok: true };
}

/** Prompt text chips shown in the bottom panel reference bar. */
export function collectAiAudioPromptReferenceChips(params: {
  readonly nodeId: string;
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
}): readonly GenerativeReferenceChip[] {
  return collectGenerativeReferenceChips({
    nodeId: params.nodeId,
    targetHandle: AI_AUDIO_PROMPT_HANDLE_ID,
    edges: params.edges,
    nodes: params.nodes,
    classifyKind: () => "text",
  });
}

/** Canvas card drop: AI text output → AI audio prompt (left handle). */
export function buildAiAudioPromptReferenceConnectionFromCardDrop(params: {
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
  if (targetNode?.data.nodeType !== AI_AUDIO_NODE_TYPE) return null;
  if (isGenerativeManualContent(targetNode.data.metadata)) return null;

  return {
    source: params.dragFromNodeId,
    sourceHandle: params.dragFromHandle.id ?? AI_TEXT_OUTPUT_ID,
    target: params.hoveredNodeId,
    targetHandle: AI_AUDIO_PROMPT_HANDLE_ID,
  };
}

export function isAiAudioPromptReferenceTarget(
  nodeType: string | undefined,
  handleId: string | null | undefined
): boolean {
  return nodeType === AI_AUDIO_NODE_TYPE && handleId === AI_AUDIO_PROMPT_HANDLE_ID;
}
