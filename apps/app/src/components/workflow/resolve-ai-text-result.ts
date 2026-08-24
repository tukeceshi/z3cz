import { getResourceIdFromValue, isResourceIdReference } from "@dafthunk/types";
import type { AiTextReferenceInput } from "@dafthunk/types";
import { AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { isAiTextGenerating, readAiTextDisplayExcerptSync, readAiTextSessionBodySync } from "./ai-text-node-utils";
import { readAiTextResultReference } from "./ai-text-persist-utils";
import { readAiTextStagingDisplayState } from "./ai-text-staging-display-state";
import { findAiTextDisplayForMediaId } from "@/services/ai-text-display-registry";
import { readAiTextFullBodyFromStaging } from "@/services/ai-text-cache-layer";
import type { GenerativeReferenceChip } from "./generative-reference-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

function readHungExcerpt(data: WorkflowNodeType): string {
  const reference = readAiTextResultReference(data.inputs);
  const mediaId = reference ? getResourceIdFromValue(reference) : null;
  if (!mediaId) {
    return "";
  }
  return findAiTextDisplayForMediaId(mediaId)?.excerpt ?? "";
}

function readHungDisplayState(data: WorkflowNodeType) {
  const reference = readAiTextResultReference(data.inputs);
  const mediaId = reference ? getResourceIdFromValue(reference) : null;
  if (!mediaId) {
    return undefined;
  }
  return findAiTextDisplayForMediaId(mediaId)?.state;
}

export function readAiTextResultExcerptSync(data: WorkflowNodeType): string | undefined {
  const excerpt = readAiTextDisplayExcerptSync(data) || readHungExcerpt(data);
  return excerpt.trim() ? excerpt : undefined;
}

/** Stream body while generating. Full text otherwise comes from staging, not session/memory. */
export function readAiTextGeneratingStreamSync(data: WorkflowNodeType): string {
  if (!isAiTextGenerating(data.metadata)) {
    return "";
  }
  return readAiTextSessionBodySync(data);
}

export async function readAiTextBodyFromStagingForNode(params: {
  readonly data: WorkflowNodeType;
  readonly organizationId?: string;
  readonly workflowId?: string;
}): Promise<string> {
  const stream = readAiTextGeneratingStreamSync(params.data);
  if (stream) {
    return stream;
  }

  const reference = readAiTextResultReference(params.data.inputs);
  if (!reference || !params.organizationId || !params.workflowId) {
    return "";
  }

  const workflowSha = isResourceIdReference(reference)
    ? reference.contentSha256
    : undefined;

  return (
    (await readAiTextFullBodyFromStaging({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      reference,
      workflowSha,
    })) ?? ""
  );
}

/** @deprecated Use readAiTextGeneratingStreamSync or readAiTextBodyFromStagingForNode */
export function readAiTextCanvasBodySync(data: WorkflowNodeType): string {
  return readAiTextGeneratingStreamSync(data);
}

/** True when the text node owns a stored resource that staging has not marked ready. */
export function isUpstreamAiTextPendingLoad(data: WorkflowNodeType): boolean {
  if (isAiTextGenerating(data.metadata)) {
    return false;
  }

  const reference = readAiTextResultReference(data.inputs);
  if (!reference) {
    return false;
  }

  const state =
    readAiTextStagingDisplayState(data.metadata) ?? readHungDisplayState(data);
  if (state === "ready" || state === "empty") {
    return false;
  }
  if (state === "failed") {
    return false;
  }
  return true;
}

export function isUpstreamAiTextFailedLoad(data: WorkflowNodeType): boolean {
  const state =
    readAiTextStagingDisplayState(data.metadata) ?? readHungDisplayState(data);
  return state === "failed";
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

    const text = await readAiTextBodyFromStagingForNode({
      data: source.data,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
    });
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

    const content = await readAiTextBodyFromStagingForNode({
      data: source.data,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
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
