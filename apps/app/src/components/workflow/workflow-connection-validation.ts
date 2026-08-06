import type { Connection, Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import type { GenerativeReferenceModelCatalogs } from "./generative-reference-model-catalogs";
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
import {
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
} from "./ai-video-node-utils";
import {
  evaluateAiAudioPromptReferenceStructural,
  isAiAudioPromptReferenceTarget,
} from "./ai-audio-prompt-reference";
import { AI_AUDIO_PROMPT_HANDLE_ID } from "./ai-audio-node-utils";
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
  [AI_VIDEO_REFERENCE_HANDLE_ID]: {
    id: AI_VIDEO_REFERENCE_HANDLE_ID,
    type: "any",
    repeated: true,
  },
  [AI_VIDEO_PROMPT_HANDLE_ID]: {
    id: AI_VIDEO_PROMPT_HANDLE_ID,
    type: "any",
    repeated: false,
  },
  [AI_AUDIO_PROMPT_HANDLE_ID]: {
    id: AI_AUDIO_PROMPT_HANDLE_ID,
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

/** Resolve an input handle, including virtual generative reference handles. */
export function resolveWorkflowInputParam(
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

/** True when an edge is attached to the given input (either stored direction). */
export function edgeTouchesInputHandle(
  edge: {
    readonly source: string;
    readonly target: string;
    readonly sourceHandle?: string | null;
    readonly targetHandle?: string | null;
  },
  inputNodeId: string,
  inputHandleId: string | null | undefined
): boolean {
  if (!inputHandleId) return false;
  return (
    (edge.target === inputNodeId && edge.targetHandle === inputHandleId) ||
    (edge.source === inputNodeId && edge.sourceHandle === inputHandleId)
  );
}

export interface ResolvedConnectionEndpoints {
  readonly inputParam: WorkflowParameter;
  readonly outputParam: WorkflowParameter;
  readonly inputNodeId: string;
  readonly inputHandleId: string;
  readonly outputNodeId: string;
  readonly outputHandleId: string;
}

/** Identify which side of a connection is the input (supports reverse drag). */
export function resolveConnectionEndpoints(
  connection: Connection,
  sourceNode: ReactFlowNode<WorkflowNodeType>,
  targetNode: ReactFlowNode<WorkflowNodeType>
): ResolvedConnectionEndpoints | null {
  const sourceOutput = sourceNode.data.outputs.find(
    (output) => output.id === connection.sourceHandle
  );
  const sourceInput = resolveWorkflowInputParam(
    sourceNode,
    connection.sourceHandle
  );
  const targetInput = resolveWorkflowInputParam(
    targetNode,
    connection.targetHandle
  );
  const targetOutput = targetNode.data.outputs.find(
    (output) => output.id === connection.targetHandle
  );

  if (
    sourceOutput &&
    targetInput &&
    connection.target &&
    connection.targetHandle
  ) {
    return {
      outputParam: sourceOutput,
      inputParam: targetInput,
      inputNodeId: connection.target,
      inputHandleId: connection.targetHandle,
      outputNodeId: connection.source!,
      outputHandleId: connection.sourceHandle!,
    };
  }

  if (
    sourceInput &&
    targetOutput &&
    connection.source &&
    connection.sourceHandle
  ) {
    return {
      outputParam: targetOutput,
      inputParam: sourceInput,
      inputNodeId: connection.source,
      inputHandleId: connection.sourceHandle,
      outputNodeId: connection.target!,
      outputHandleId: connection.targetHandle!,
    };
  }

  return null;
}

export interface ValidateWorkflowConnectionParams {
  readonly connection: Connection;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly generativeReferenceCatalogs?: GenerativeReferenceModelCatalogs;
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

  const endpoints = resolveConnectionEndpoints(conn, sourceNode, targetNode);
  if (!endpoints) return false;

  const {
    inputParam,
    outputParam,
    inputNodeId,
    inputHandleId,
  } = endpoints;

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
        targetNodeMetadata: hostNode.data.metadata,
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
        models: params.generativeReferenceCatalogs?.imageModels,
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
      targetNodeMetadata: hostNode.data.metadata,
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
        targetNodeMetadata: hostNode.data.metadata,
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
        models: params.generativeReferenceCatalogs?.videoModels,
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
      targetNodeMetadata: hostNode.data.metadata,
      sourceNodeId,
      sourceNodeType: refSourceNode.data.nodeType,
      edges,
    });
    if (!verdict.ok) return false;
  }

  if (
    hostNode &&
    isAiAudioPromptReferenceTarget(hostNode.data.nodeType, inputHandleId)
  ) {
    const sourceNodeId =
      inputNodeId === conn.target ? conn.source : conn.target;
    const refSourceNode = nodes.find((node) => node.id === sourceNodeId);
    if (!refSourceNode) return false;

    const verdict = evaluateAiAudioPromptReferenceStructural({
      targetNodeId: inputNodeId,
      targetNodeMetadata: hostNode.data.metadata,
      sourceNodeId,
      sourceNodeType: refSourceNode.data.nodeType,
      edges,
    });
    if (!verdict.ok) return false;
  }

  // Non-repeated inputs are exclusive; outputs may fan out to many targets.
  if (!inputParam.repeated) {
    const hasExistingConnection = edges.some((edge) =>
      edgeTouchesInputHandle(edge, inputNodeId, inputHandleId)
    );
    if (hasExistingConnection) return false;
  }

  return extraValidate?.(conn) ?? true;
}
