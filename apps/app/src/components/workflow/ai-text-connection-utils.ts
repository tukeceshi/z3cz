import { AI_TEXT_NODE_TYPE, AI_IMAGE_NODE_TYPE, AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import {
  type Edge as ReactFlowEdge,
  type InternalNode,
  type Node,
  type Transform,
} from "@xyflow/react";

import {
  AI_AUDIO_OUTPUT_ID,
  AI_AUDIO_PROMPT_HANDLE_ID,
} from "./ai-audio-node-utils";
import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_OUTPUT_ID,
  isAiTextAllowedReferenceNodeType,
} from "./ai-text-node-utils";
import {
  AI_IMAGE_OUTPUT_ID,
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
} from "./ai-image-node-utils";
import {
  snapAiImageOutputBorderPoint,
  snapAiImageReferenceBorderPoint,
} from "./ai-image-connection-utils";
import {
  isIncomingAiTextReferenceAllowed,
  isIncomingAiTextReferenceConnection,
} from "./ai-text-reference-policy";
import { nodeIdUnderPanePointer } from "./connection-pane-hit-test";
import {
  snapGenerativeContentBorderPoint,
} from "./generative-node-content-geometry";
import {
  snapAiVideoOutputBorderPoint,
  snapAiVideoReferenceBorderPoint,
} from "./ai-video-connection-utils";
import {
  AI_VIDEO_OUTPUT_ID,
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
} from "./ai-video-node-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

/** LibTV-style circular hit zone (px). */
export const AI_TEXT_HANDLE_HIT_PX = 80;
/** Visible plus icon (px). */
export const AI_TEXT_HANDLE_PLUS_PX = 20;
/** Gap between card border and nearest plus edge (px). */
export const AI_TEXT_PLUS_BORDER_GAP_PX = 10;
/** Plus band outside the border (gap + icon). */
export const AI_TEXT_EDGE_PLUS_OUTER_PX =
  AI_TEXT_PLUS_BORDER_GAP_PX + AI_TEXT_HANDLE_PLUS_PX;
/** Interaction shell width: handle zone + outer plus band. */
export const AI_TEXT_EDGE_SHELL_W_PX =
  AI_TEXT_HANDLE_HIT_PX + AI_TEXT_EDGE_PLUS_OUTER_PX;

interface AiTextSnapTarget {
  readonly nodeId: string;
  readonly x: number;
  readonly y: number;
}

interface AiTextConnectionContext {
  readonly domNode: HTMLDivElement | null;
  readonly transform: Transform;
}

export type { AiTextConnectionContext };

interface FlowConnection {
  readonly inProgress: boolean;
  readonly fromNode: InternalNode<Node> | null;
  readonly fromHandle: { readonly type: string; readonly id?: string | null } | null;
  readonly to: { readonly x: number; readonly y: number } | null;
  readonly toNode?: InternalNode<Node> | null;
  readonly pointer?: { readonly x: number; readonly y: number } | null;
}

type AiTextReferenceEdge = Pick<
  ReactFlowEdge<WorkflowEdgeType>,
  "source" | "target" | "sourceHandle" | "targetHandle"
>;

function policyNodesFromLookup(
  nodeLookup: Map<string, InternalNode<Node>>
): readonly Pick<Node<WorkflowNodeType>, "id" | "data">[] {
  return Array.from(nodeLookup.values()).map((node) => ({
    id: node.id,
    data: node.data as WorkflowNodeType,
  }));
}

function isAllowedAiTextIncomingTarget(
  connection: FlowConnection,
  targetId: string,
  nodeLookup: Map<string, InternalNode<Node>>,
  edges: readonly AiTextReferenceEdge[]
): boolean {
  const targetNode = nodeLookup.get(targetId);
  if (!targetNode || !isAiTextTargetNode(targetNode)) return false;

  return isIncomingAiTextReferenceAllowed({
    connection,
    targetNodeId: targetId,
    targetNodeData: targetNode.data as WorkflowNodeType,
    edges,
    nodes: policyNodesFromLookup(nodeLookup),
  });
}

function workflowParameterTypesConnect(
  outputType: string,
  inputType: string
): boolean {
  const blobTypes = new Set([
    "image",
    "audio",
    "video",
    "document",
    "buffergeometry",
    "gltf",
  ]);
  const exactMatch = outputType === inputType;
  const anyTypeMatch = outputType === "any" || inputType === "any";
  const blobCompatible =
    (outputType === "blob" && blobTypes.has(inputType)) ||
    (inputType === "blob" && blobTypes.has(outputType));
  return exactMatch || anyTypeMatch || blobCompatible;
}

/** Another node wiring into this AI text node's right text output. */
function isAllowedAiTextOutputTarget(
  connection: FlowConnection,
  aiTextNodeId: string,
  nodeLookup: Map<string, InternalNode<Node>>
): boolean {
  const fromNode = connection.fromNode;
  if (!fromNode || fromNode.id === aiTextNodeId) return false;

  const aiTextNode = nodeLookup.get(aiTextNodeId);
  if (!aiTextNode || !isAiTextTargetNode(aiTextNode)) return false;

  const textOutput = (aiTextNode.data as WorkflowNodeType).outputs?.find(
    (output) => output.id === AI_TEXT_OUTPUT_ID
  );
  if (!textOutput) return false;

  const fromHandle = connection.fromHandle;
  if (!fromHandle?.id || fromHandle.type !== "target") return false;

  const fromInput = (fromNode.data as WorkflowNodeType).inputs?.find(
    (input) => input.id === fromHandle.id
  );
  if (!fromInput) return false;

  return workflowParameterTypesConnect(textOutput.type, fromInput.type);
}

function isAiTextValidHighlightTarget(
  connection: FlowConnection,
  targetId: string,
  nodeLookup: Map<string, InternalNode<Node>>,
  edges: readonly AiTextReferenceEdge[]
): boolean {
  if (isIncomingAiTextReferenceConnection(connection)) {
    return isAllowedAiTextIncomingTarget(
      connection,
      targetId,
      nodeLookup,
      edges
    );
  }

  return isAllowedAiTextOutputTarget(connection, targetId, nodeLookup);
}

function connectionPointer(
  connection: FlowConnection
): { x: number; y: number } | null {
  return connection.pointer ?? connection.to;
}

/**
 * Whole-card hit test from React Flow connection pointer.
 * `connection.pointer` is pane-local (not flow coords).
 */
export function nodeIdUnderFlowPointerForPreview(
  panePointer: { x: number; y: number },
  context: AiTextConnectionContext
): string | null {
  return nodeIdUnderPanePointer(panePointer, { domNode: context.domNode });
}

function nodeIdUnderFlowPointer(
  panePointer: { x: number; y: number },
  context: AiTextConnectionContext
): string | null {
  return nodeIdUnderFlowPointerForPreview(panePointer, context);
}

function aiTextSnapFromNode(node: InternalNode<Node>): AiTextSnapTarget {
  const point = snapGenerativeContentBorderPoint(node, "left");
  return {
    nodeId: node.id,
    x: point.x,
    y: point.y,
  };
}

function isAiTextTargetNode(node: InternalNode<Node>): boolean {
  return (
    (node.data as { nodeType?: string } | undefined)?.nodeType ===
    AI_TEXT_NODE_TYPE
  );
}

/** Which AI text node is a valid connection target — left keywords or right text output. */
export function findAiTextConnectionTargetNodeId(
  connection: FlowConnection,
  nodeLookup: Map<string, InternalNode<Node>>,
  context: AiTextConnectionContext,
  edges: readonly AiTextReferenceEdge[]
): string | null {
  if (!connection.inProgress || !connection.fromNode) return null;

  const pointer = connectionPointer(connection);
  if (!pointer) return null;

  const resolveTarget = (targetId: string | null | undefined): string | null => {
    if (!targetId || targetId === connection.fromNode?.id) return null;
    if (
      !isAiTextValidHighlightTarget(
        connection,
        targetId,
        nodeLookup,
        edges
      )
    ) {
      return null;
    }
    return targetId;
  };

  // Prefer the card under the pointer; do not fall back to RF `toNode`
  // (handle proximity often snaps to a distant neighbor).
  return resolveTarget(nodeIdUnderFlowPointer(pointer, context));
}

export function findAiTextConnectionSnap(
  connection: FlowConnection,
  nodeLookup: Map<string, InternalNode<Node>>,
  context: AiTextConnectionContext,
  edges: readonly AiTextReferenceEdge[]
): AiTextSnapTarget | null {
  if (!connection.inProgress || !connection.fromNode) {
    return null;
  }
  if (!isIncomingAiTextReferenceConnection(connection)) return null;

  const targetId = findAiTextConnectionTargetNodeId(
    connection,
    nodeLookup,
    context,
    edges
  );
  if (!targetId) return null;

  const node = nodeLookup.get(targetId);
  if (!node) return null;
  return aiTextSnapFromNode(node);
}

/**
 * Step-path lead-out before the bend.
 * Generative edges use the plus-border gap so the stub sits in the
 * card↔plus band (endpoints stay on the border).
 */
export function getAiTextEdgePathOffset(
  sourceNodeType: string | undefined,
  targetNodeType: string | undefined,
  sourceHandle?: string | null,
  targetHandle?: string | null
): number {
  if (
    sourceHandle === AI_TEXT_OUTPUT_ID ||
    sourceHandle === AI_IMAGE_OUTPUT_ID ||
    sourceHandle === AI_VIDEO_OUTPUT_ID ||
    sourceHandle === AI_AUDIO_OUTPUT_ID ||
    targetHandle === AI_TEXT_KEYWORDS_HANDLE_ID ||
    targetHandle === AI_IMAGE_REFERENCE_HANDLE_ID ||
    targetHandle === AI_IMAGE_PROMPT_HANDLE_ID ||
    targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID ||
    targetHandle === AI_VIDEO_PROMPT_HANDLE_ID ||
    targetHandle === AI_AUDIO_PROMPT_HANDLE_ID ||
    (targetNodeType === AI_TEXT_NODE_TYPE &&
      isAiTextAllowedReferenceNodeType(sourceNodeType))
  ) {
    return AI_TEXT_PLUS_BORDER_GAP_PX;
  }
  if (
    sourceNodeType === AI_TEXT_NODE_TYPE ||
    targetNodeType === AI_TEXT_NODE_TYPE
  ) {
    return AI_TEXT_PLUS_BORDER_GAP_PX;
  }
  return 20;
}

export function resolveWorkflowEdgeHandles(params: {
  readonly sourceHandle?: string | null;
  readonly targetHandle?: string | null;
  readonly dataSourceHandle?: string | null;
  readonly dataTargetHandle?: string | null;
}): { sourceHandle?: string; targetHandle?: string } {
  return {
    sourceHandle:
      params.sourceHandle ??
      params.dataSourceHandle ??
      undefined,
    targetHandle:
      params.targetHandle ??
      params.dataTargetHandle ??
      undefined,
  };
}

/** Snap completed/preview edge anchors to AI text card borders. */
export function resolveAiTextEdgeAnchors(params: {
  readonly sourceX: number;
  readonly sourceY: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string | null;
  readonly targetHandle?: string | null;
  readonly dataSourceHandle?: string | null;
  readonly dataTargetHandle?: string | null;
  readonly nodeLookup: Map<string, InternalNode<Node>>;
}): {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
} {
  const resolved = resolveWorkflowEdgeHandles({
    sourceHandle: params.sourceHandle,
    targetHandle: params.targetHandle,
    dataSourceHandle: params.dataSourceHandle,
    dataTargetHandle: params.dataTargetHandle,
  });

  let { sourceX, sourceY, targetX, targetY } = params;

  const inboundReference = isAiTextInboundReferenceEdge({
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle,
    targetHandle: params.targetHandle,
    dataSourceHandle: params.dataSourceHandle,
    dataTargetHandle: params.dataTargetHandle,
    nodeLookup: params.nodeLookup,
  });

  if (resolved.sourceHandle === AI_TEXT_OUTPUT_ID) {
    const node = params.nodeLookup.get(params.source);
    if (node) {
      const snap = snapAiTextOutputBorderPoint(node);
      sourceX = snap.x;
      sourceY = snap.y;
    }
  } else if (resolved.sourceHandle === AI_IMAGE_OUTPUT_ID) {
    const node = params.nodeLookup.get(params.source);
    if (node) {
      const snap = snapAiImageOutputBorderPoint(node);
      sourceX = snap.x;
      sourceY = snap.y;
    }
  } else if (resolved.sourceHandle === AI_VIDEO_OUTPUT_ID) {
    const node = params.nodeLookup.get(params.source);
    if (node) {
      const snap = snapAiVideoOutputBorderPoint(node);
      sourceX = snap.x;
      sourceY = snap.y;
    }
  }

  if (inboundReference) {
    const node = params.nodeLookup.get(params.target);
    if (node) {
      const snapPoint = snapAiTextKeywordsBorderPoint(node);
      targetX = snapPoint.x;
      targetY = snapPoint.y;
    }
  } else if (
    resolved.targetHandle === AI_IMAGE_REFERENCE_HANDLE_ID ||
    resolved.targetHandle === AI_IMAGE_PROMPT_HANDLE_ID ||
    resolved.targetHandle === AI_TEXT_KEYWORDS_HANDLE_ID ||
    resolved.targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID ||
    resolved.targetHandle === AI_VIDEO_PROMPT_HANDLE_ID ||
    resolved.targetHandle === AI_AUDIO_PROMPT_HANDLE_ID
  ) {
    const node = params.nodeLookup.get(params.target);
    if (node) {
      const nodeType = readNodeType(node);
      const snapPoint =
        nodeType === AI_IMAGE_NODE_TYPE
          ? snapAiImageReferenceBorderPoint(node)
          : nodeType === AI_VIDEO_NODE_TYPE
            ? snapAiVideoReferenceBorderPoint(node)
            : resolved.targetHandle === AI_AUDIO_PROMPT_HANDLE_ID
              ? snapGenerativeContentBorderPoint(node, "left")
              : snapAiTextKeywordsBorderPoint(node);
      targetX = snapPoint.x;
      targetY = snapPoint.y;
    }
  } else if (
    resolved.targetHandle === AI_TEXT_OUTPUT_ID ||
    resolved.targetHandle === AI_IMAGE_OUTPUT_ID ||
    resolved.targetHandle === AI_VIDEO_OUTPUT_ID
  ) {
    const node = params.nodeLookup.get(params.target);
    if (node) {
      const nodeType = readNodeType(node);
      const snapPoint =
        nodeType === AI_IMAGE_NODE_TYPE
          ? snapAiImageOutputBorderPoint(node)
          : nodeType === AI_VIDEO_NODE_TYPE
            ? snapAiVideoOutputBorderPoint(node)
            : snapAiTextOutputBorderPoint(node);
      targetX = snapPoint.x;
      targetY = snapPoint.y;
    }
  }

  return { sourceX, sourceY, targetX, targetY };
}

function readNodeType(
  node: InternalNode<Node> | undefined
): string | undefined {
  return (node?.data as { nodeType?: string } | undefined)?.nodeType;
}

/** Inbound reference edge into AI text keywords (handles may live only on edge.data). */
export function isAiTextInboundReferenceEdge(params: {
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string | null;
  readonly targetHandle?: string | null;
  readonly dataSourceHandle?: string | null;
  readonly dataTargetHandle?: string | null;
  readonly nodeLookup: Map<string, InternalNode<Node>>;
}): boolean {
  if (!params.target || params.source === params.target) {
    return false;
  }

  const resolved = resolveWorkflowEdgeHandles({
    sourceHandle: params.sourceHandle,
    targetHandle: params.targetHandle,
    dataSourceHandle: params.dataSourceHandle,
    dataTargetHandle: params.dataTargetHandle,
  });

  if (resolved.targetHandle === AI_TEXT_KEYWORDS_HANDLE_ID) {
    return true;
  }

  const targetNode = params.nodeLookup.get(params.target);
  const sourceNode = params.nodeLookup.get(params.source);
  const targetType = readNodeType(targetNode);
  const sourceType = readNodeType(sourceNode);

  if (targetType !== AI_TEXT_NODE_TYPE) {
    return false;
  }

  return isAiTextAllowedReferenceNodeType(sourceType);
}

export function snapAiTextKeywordsBorderPoint(
  node: InternalNode<Node>
): { x: number; y: number } {
  return snapGenerativeContentBorderPoint(node, "left");
}

export function snapAiTextOutputBorderPoint(
  node: InternalNode<Node>
): { x: number; y: number } {
  return snapGenerativeContentBorderPoint(node, "right");
}
