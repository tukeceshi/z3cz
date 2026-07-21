import type { Connection, Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import {
  evaluateAiImageReferenceStructural,
  isAiImageReferenceTarget,
} from "./ai-image-reference-policy";
import {
  evaluateAiImagePromptReferenceStructural,
  isAiImagePromptReferenceTarget,
} from "./ai-image-prompt-reference";
import {
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
} from "./ai-image-node-utils";
import {
  evaluateAiVideoReferenceStructural,
  isAiVideoReferenceTarget,
} from "./ai-video-reference-policy";
import {
  evaluateAiVideoPromptReferenceStructural,
  isAiVideoPromptReferenceTarget,
} from "./ai-video-prompt-reference";
import { AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import {
  evaluateAiTextReferenceStructural,
  isAiTextKeywordsTarget,
} from "./ai-text-reference-policy";
import { AI_TEXT_KEYWORDS_HANDLE_ID } from "./ai-text-node-utils";
import type { WorkflowEdgeType, WorkflowNodeType, WorkflowParameter } from "./workflow-types";

const BLOB_TYPES = new Set([
  "image",
  "audio",
  "video",
  "document",
  "buffergeometry",
  "gltf",
]);

const VIRTUAL_REFERENCE_INPUTS: Readonly<
  Record<string, Pick<WorkflowParameter, "id" | "type" | "repeated">>
> = {
  [AI_TEXT_KEYWORDS_HANDLE_ID]: {
    id: AI_TEXT_KEYWORDS_HANDLE_ID,
    type: "any",
    repeated: true,
  },
  [AI_IMAGE_REFERENCE_HANDLE_ID]: {
    id: AI_IMAGE_REFERENCE_HANDLE_ID,
    type: "any",
    repeated: true,
  },
  [AI_IMAGE_PROMPT_HANDLE_ID]: {
    id: AI_IMAGE_PROMPT_HANDLE_ID,
    type: "any",
    repeated: false,
  },
};

function workflowParameterTypesConnect(
  outputType: string,
  inputType: string
): boolean {
  const exactMatch = outputType === inputType;
  const anyTypeMatch = outputType === "any" || inputType === "any";
  const blobCompatible =
    (outputType === "blob" && BLOB_TYPES.has(inputType)) ||
    (inputType === "blob" && BLOB_TYPES.has(outputType));
  return exactMatch || anyTypeMatch || blobCompatible;
}

function resolveInputParam(
  node: ReactFlowNode<WorkflowNodeType>,
  handleId: string | null | undefined
): WorkflowParameter | undefined {
  if (!handleId) return undefined;
  const fromInputs = node.data.inputs.find((input) => input.id === handleId);
  if (fromInputs) return fromInputs;
  const virtual = VIRTUAL_REFERENCE_INPUTS[handleId];
  if (!virtual) return undefined;
  return {
    ...virtual,
    name: virtual.id,
  } as WorkflowParameter;
}

export interface ValidateWorkflowConnectionParams {
  readonly connection: Connection;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly extraValidate?: (connection: Connection) => boolean;
  readonly disabled?: boolean;
}

/** Shared connect rules for isValidConnection and generative preview line coloring. */
export function validateWorkflowConnection(
  params: ValidateWorkflowConnectionParams
): boolean {
  const { connection: conn, nodes, edges, extraValidate, disabled } = params;

  if (disabled) return false;
  if (!conn.source || !conn.target) return false;

  const sourceNode = nodes.find((node) => node.id === conn.source);
  const targetNode = nodes.find((node) => node.id === conn.target);
  if (!sourceNode || !targetNode) return false;

  const sourceOutput = sourceNode.data.outputs.find(
    (output) => output.id === conn.sourceHandle
  );
  const sourceInput = resolveInputParam(sourceNode, conn.sourceHandle);
  const targetInput = resolveInputParam(targetNode, conn.targetHandle);
  const targetOutput = targetNode.data.outputs.find(
    (output) => output.id === conn.targetHandle
  );

  let inputParam: WorkflowParameter | undefined;
  let outputParam: WorkflowParameter | undefined;
  let inputNodeId: string | undefined;
  let inputHandleId: string | null | undefined;

  if (sourceOutput && targetInput) {
    outputParam = sourceOutput;
    inputParam = targetInput;
    inputNodeId = conn.target;
    inputHandleId = conn.targetHandle;
  } else if (sourceInput && targetOutput) {
    outputParam = targetOutput;
    inputParam = sourceInput;
    inputNodeId = conn.source;
    inputHandleId = conn.sourceHandle;
  } else {
    return false;
  }

  if (
    !workflowParameterTypesConnect(outputParam.type, inputParam.type)
  ) {
    return false;
  }

  const hostNode = nodes.find((node) => node.id === inputNodeId);
  if (
    hostNode &&
    isAiTextKeywordsTarget(hostNode.data.nodeType, inputHandleId)
  ) {
    const sourceNodeId =
      inputNodeId === conn.target ? conn.source : conn.target;
    const refSourceNode = nodes.find((node) => node.id === sourceNodeId);
    if (!refSourceNode) return false;

    const verdict = evaluateAiTextReferenceStructural({
      targetNodeId: inputNodeId,
      sourceNodeId,
      sourceHandle: conn.sourceHandle,
      sourceNodeType: refSourceNode.data.nodeType,
      targetNodeData: hostNode.data,
      edges,
      nodes: nodes.map((node) => ({ id: node.id, data: node.data })),
    });
    if (!verdict.ok) return false;
  }

  if (
    hostNode &&
    isAiImageReferenceTarget(hostNode.data.nodeType, inputHandleId)
  ) {
    const sourceNodeId =
      inputNodeId === conn.target ? conn.source : conn.target;
    const refSourceNode = nodes.find((node) => node.id === sourceNodeId);
    if (!refSourceNode) return false;

    if (refSourceNode.data.nodeType === AI_TEXT_NODE_TYPE) {
      const verdict = evaluateAiImagePromptReferenceStructural({
        targetNodeId: inputNodeId,
        sourceNodeId,
        sourceNodeType: refSourceNode.data.nodeType,
        edges,
      });
      if (!verdict.ok) return false;
    } else {
      const verdict = evaluateAiImageReferenceStructural({
        targetNodeId: inputNodeId,
        sourceNodeId,
        sourceHandle: conn.sourceHandle,
        sourceNodeType: refSourceNode.data.nodeType,
        targetNodeData: hostNode.data,
        edges,
        nodes: nodes.map((node) => ({ id: node.id, data: node.data })),
      });
      if (!verdict.ok) return false;
    }
  }

  if (
    hostNode &&
    isAiImagePromptReferenceTarget(hostNode.data.nodeType, inputHandleId)
  ) {
    const sourceNodeId =
      inputNodeId === conn.target ? conn.source : conn.target;
    const refSourceNode = nodes.find((node) => node.id === sourceNodeId);
    if (!refSourceNode) return false;

    const verdict = evaluateAiImagePromptReferenceStructural({
      targetNodeId: inputNodeId,
      sourceNodeId,
      sourceNodeType: refSourceNode.data.nodeType,
      edges,
    });
    if (!verdict.ok) return false;
  }

  if (
    hostNode &&
    isAiVideoReferenceTarget(hostNode.data.nodeType, inputHandleId)
  ) {
    const sourceNodeId =
      inputNodeId === conn.target ? conn.source : conn.target;
    const refSourceNode = nodes.find((node) => node.id === sourceNodeId);
    if (!refSourceNode) return false;

    if (refSourceNode.data.nodeType === AI_TEXT_NODE_TYPE) {
      const verdict = evaluateAiVideoPromptReferenceStructural({
        targetNodeId: inputNodeId,
        sourceNodeId,
        sourceNodeType: refSourceNode.data.nodeType,
        edges,
      });
      if (!verdict.ok) return false;
    } else {
      const verdict = evaluateAiVideoReferenceStructural({
        targetNodeId: inputNodeId,
        sourceNodeId,
        sourceHandle: conn.sourceHandle,
        sourceNodeType: refSourceNode.data.nodeType,
        targetNodeData: hostNode.data,
        edges,
        nodes: nodes.map((node) => ({ id: node.id, data: node.data })),
      });
      if (!verdict.ok) return false;
    }
  }

  if (
    hostNode &&
    isAiVideoPromptReferenceTarget(hostNode.data.nodeType, inputHandleId)
  ) {
    const sourceNodeId =
      inputNodeId === conn.target ? conn.source : conn.target;
    const refSourceNode = nodes.find((node) => node.id === sourceNodeId);
    if (!refSourceNode) return false;

    const verdict = evaluateAiVideoPromptReferenceStructural({
      targetNodeId: inputNodeId,
      sourceNodeId,
      sourceNodeType: refSourceNode.data.nodeType,
      edges,
    });
    if (!verdict.ok) return false;
  }

  if (!inputParam.repeated) {
    const hasExistingConnection = edges.some(
      (edge) =>
        (edge.target === inputNodeId &&
          edge.targetHandle === inputHandleId) ||
        (edge.source === inputNodeId && edge.sourceHandle === inputHandleId)
    );
    if (hasExistingConnection) return false;
  }

  return extraValidate?.(conn) ?? true;
}
