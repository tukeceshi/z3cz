import { getResourceIdFromValue } from "@dafthunk/types";
import type { AiTextReferenceInput } from "@dafthunk/types";
import { AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { readAiTextDisplayExcerptSync, readAiTextResultTextSync } from "./ai-text-node-utils";
import { readAiTextResultReference } from "./ai-text-persist-utils";
import { findAiTextDisplayForMediaId } from "@/services/ai-text-display-registry";
import type { GenerativeReferenceChip } from "./generative-reference-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

function readHungBody(data: WorkflowNodeType): string {
  const reference = readAiTextResultReference(data.inputs);
  const mediaId = reference ? getResourceIdFromValue(reference) : null;
  if (!mediaId) {
    return "";
  }
  return findAiTextDisplayForMediaId(mediaId)?.body ?? "";
}

function readHungExcerpt(data: WorkflowNodeType): string {
  const reference = readAiTextResultReference(data.inputs);
  const mediaId = reference ? getResourceIdFromValue(reference) : null;
  if (!mediaId) {
    return "";
  }
  return findAiTextDisplayForMediaId(mediaId)?.excerpt ?? "";
}

export function readAiTextResultExcerptSync(data: WorkflowNodeType): string | undefined {
  const excerpt = readAiTextDisplayExcerptSync(data) || readHungExcerpt(data);
  return excerpt.trim() ? excerpt : undefined;
}

export function readAiTextCanvasBodySync(data: WorkflowNodeType): string {
  return readAiTextResultTextSync(data) || readHungBody(data);
}

/** True when the text node owns a stored body that is not yet hung for display. */
export function isUpstreamAiTextPendingLoad(data: WorkflowNodeType): boolean {
  if (readAiTextCanvasBodySync(data)) {
    return false;
  }
  return readAiTextResultReference(data.inputs) != null;
}

export function resolveReferencedAiTextFromEdges(params: {
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
}): string {
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

    const text = readAiTextCanvasBodySync(source.data);
    if (text) {
      parts.push(text);
    }
  }

  return parts.join("\n");
}

export function isReferencedAiTextPendingFromEdges(params: {
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
}): boolean {
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

    if (isUpstreamAiTextPendingLoad(source.data)) {
      return true;
    }
  }

  return false;
}

export function resolveAiTextReferenceInputsFromChips(params: {
  readonly chips: readonly GenerativeReferenceChip[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): readonly AiTextReferenceInput[] {
  const results: AiTextReferenceInput[] = [];

  for (const chip of params.chips) {
    if (chip.kind !== "text") {
      continue;
    }

    const source = params.nodes.find((node) => node.id === chip.sourceNodeId);
    if (!source) {
      continue;
    }

    const content = readAiTextCanvasBodySync(source.data);
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

export function isAiTextReferencePendingFromChips(params: {
  readonly chips: readonly GenerativeReferenceChip[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): boolean {
  for (const chip of params.chips) {
    if (chip.kind !== "text") {
      continue;
    }

    const source = params.nodes.find((node) => node.id === chip.sourceNodeId);
    if (!source) {
      continue;
    }

    if (isUpstreamAiTextPendingLoad(source.data)) {
      return true;
    }
  }

  return false;
}
