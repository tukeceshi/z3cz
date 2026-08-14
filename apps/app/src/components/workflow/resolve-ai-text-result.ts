import { AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import type { AiTextReferenceInput } from "@dafthunk/types";
import { buildAiTextExcerpt } from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { readAiTextContent } from "@/services/ai-text-storage-service";

import { readAiTextResultTextSync } from "./ai-text-node-utils";
import { readAiTextResultReference } from "./ai-text-persist-utils";
import type { GenerativeReferenceChip } from "./generative-reference-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export function readAiTextResultExcerptSync(data: WorkflowNodeType): string | undefined {
  const text = readAiTextResultTextSync(data);
  return text ? buildAiTextExcerpt(text) : undefined;
}

export async function resolveAiTextResultText(params: {
  readonly organizationId?: string;
  readonly workflowId?: string;
  readonly data: WorkflowNodeType;
}): Promise<string> {
  const sync = readAiTextResultTextSync(params.data);
  if (sync) {
    return sync;
  }

  if (!params.organizationId || !params.workflowId) {
    return "";
  }

  const reference = readAiTextResultReference(params.data.inputs);
  if (!reference) {
    return "";
  }

  const loaded = await readAiTextContent({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    value: reference,
  });
  return loaded?.trim() ?? "";
}

export async function resolveReferencedAiTextFromEdges(params: {
  readonly nodeId: string;
  readonly targetHandle: string;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "targetHandle"
  >[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
  readonly organizationId?: string;
  readonly workflowId?: string;
}): Promise<string> {
  const parts: string[] = [];

  for (const edge of params.edges) {
    if (
      edge.target !== params.nodeId ||
      edge.targetHandle !== params.targetHandle
    ) {
      continue;
    }

    const source = params.nodes.find((node) => node.id === edge.source);
    if (!source || source.data.nodeType !== AI_TEXT_NODE_TYPE) {
      continue;
    }

    const text = await resolveAiTextResultText({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      data: source.data,
    });
    if (text) {
      parts.push(text);
    }
  }

  return parts.join("\n");
}

export async function resolveAiTextReferenceInputsFromChips(params: {
  readonly chips: readonly GenerativeReferenceChip[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
  readonly organizationId?: string;
  readonly workflowId?: string;
}): Promise<readonly AiTextReferenceInput[]> {
  const results: AiTextReferenceInput[] = [];

  for (const chip of params.chips) {
    if (chip.kind !== "text") {
      continue;
    }

    const source = params.nodes.find((node) => node.id === chip.sourceNodeId);
    if (!source) {
      continue;
    }

    const content = await resolveAiTextResultText({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      data: source.data,
    });
    if (!content) {
      continue;
    }

    results.push({
      name: chip.label,
      content,
    });
  }

  return results;
}
