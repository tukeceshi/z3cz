import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { AI_TEXT_OUTPUT_ID } from "./ai-text-node-utils";
import { AI_IMAGE_PROMPT_HANDLE_ID } from "./ai-image-node-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface AiImagePromptReferenceEdge {
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
  readonly sourceNodeId: string;
  readonly sourceNodeType: string | undefined;
}): { readonly ok: boolean } {
  if (params.sourceNodeId === params.targetNodeId) {
    return { ok: false };
  }
  if (params.sourceNodeType !== AI_TEXT_NODE_TYPE) {
    return { ok: false };
  }
  return { ok: true };
}

export function isAiImagePromptReferenceTarget(
  nodeType: string | undefined,
  handleId: string | null | undefined
): boolean {
  return nodeType === AI_IMAGE_NODE_TYPE && handleId === AI_IMAGE_PROMPT_HANDLE_ID;
}
