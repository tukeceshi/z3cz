import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import type { Connection, InternalNode, Node } from "@xyflow/react";

import {
  buildAiImageReferenceConnectionFromCardDrop,
  isIncomingAiImageReferenceConnection,
} from "./ai-image-reference-policy";
import { snapAiImageReferenceBorderPoint } from "./ai-image-connection-utils";
import { AI_IMAGE_REFERENCE_HANDLE_ID } from "./ai-image-node-utils";
import {
  buildAiTextReferenceConnectionFromCardDrop,
  isIncomingAiTextReferenceConnection,
} from "./ai-text-reference-policy";
import {
  nodeIdUnderFlowPointerForPreview,
  snapAiTextKeywordsBorderPoint,
  snapAiTextOutputBorderPoint,
  type AiTextConnectionContext,
} from "./ai-text-connection-utils";
import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_OUTPUT_ID,
} from "./ai-text-node-utils";
import type { WorkflowNodeType } from "./workflow-types";

export interface FlowConnectionLike {
  readonly inProgress: boolean;
  readonly fromNode: InternalNode<Node> | null;
  readonly fromHandle: {
    readonly type: string;
    readonly id?: string | null;
  } | null;
  readonly to: { readonly x: number; readonly y: number } | null;
  readonly toNode?: InternalNode<Node> | null;
  readonly pointer?: { readonly x: number; readonly y: number } | null;
}

export interface GenerativePreviewSnap {
  readonly nodeId: string;
  readonly x: number;
  readonly y: number;
  readonly targetHandle: string;
  readonly side: "left" | "right";
}

export interface GenerativePreviewConnection {
  readonly connection: Connection;
  readonly snap: GenerativePreviewSnap;
}

export interface GenerativeDragPreviewState {
  readonly previewConnection: Connection | null;
  readonly snap: GenerativePreviewSnap | null;
  readonly previewAllowed: boolean | null;
}

function connectionPointer(
  connection: FlowConnectionLike
): { x: number; y: number } | null {
  return connection.pointer ?? connection.to;
}

function readNodeType(node: InternalNode<Node> | undefined): string | undefined {
  return (node?.data as { nodeType?: string } | undefined)?.nodeType;
}

function isGenerativeNodeType(nodeType: string | undefined): boolean {
  return nodeType === AI_TEXT_NODE_TYPE || nodeType === AI_IMAGE_NODE_TYPE;
}

/** Dragging from another node's input toward a generative card's right output. */
function isIncomingGenerativeOutputPick(connection: FlowConnectionLike): boolean {
  const fromHandle = connection.fromHandle;
  if (!connection.fromNode || !fromHandle) return false;
  if (fromHandle.type !== "target") return false;
  if (
    fromHandle.id === AI_TEXT_KEYWORDS_HANDLE_ID ||
    fromHandle.id === AI_IMAGE_REFERENCE_HANDLE_ID
  ) {
    return false;
  }
  return true;
}

/** AI image → AI text reference lands on the AI text card's right border. */
function isAiImageToAiTextReferenceTarget(
  fromNodeType: string | undefined,
  targetNodeType: string
): boolean {
  return (
    fromNodeType === AI_IMAGE_NODE_TYPE && targetNodeType === AI_TEXT_NODE_TYPE
  );
}

function snapFromGenerativeReferenceTarget(
  node: InternalNode<Node>,
  nodeType: string,
  fromNodeType: string | undefined
): GenerativePreviewSnap | null {
  if (isAiImageToAiTextReferenceTarget(fromNodeType, nodeType)) {
    const point = snapAiTextOutputBorderPoint(node);
    return {
      nodeId: node.id,
      x: point.x,
      y: point.y,
      targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      side: "right",
    };
  }

  if (nodeType === AI_TEXT_NODE_TYPE) {
    const point = snapAiTextKeywordsBorderPoint(node);
    return {
      nodeId: node.id,
      x: point.x,
      y: point.y,
      targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      side: "left",
    };
  }
  if (nodeType === AI_IMAGE_NODE_TYPE) {
    const point = snapAiImageReferenceBorderPoint(node);
    return {
      nodeId: node.id,
      x: point.x,
      y: point.y,
      targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
      side: "left",
    };
  }
  return null;
}

function snapFromGenerativeOutputTarget(
  node: InternalNode<Node>,
  nodeType: string
): GenerativePreviewSnap | null {
  if (nodeType === AI_TEXT_NODE_TYPE) {
    const point = snapAiTextOutputBorderPoint(node);
    return {
      nodeId: node.id,
      x: point.x,
      y: point.y,
      targetHandle: AI_TEXT_OUTPUT_ID,
      side: "right",
    };
  }
  return null;
}

function resolveHoveredGenerativeNodeId(
  connection: FlowConnectionLike,
  context: AiTextConnectionContext
): string | null {
  const pointer = connectionPointer(connection);
  if (!pointer || !connection.fromNode) return null;

  const hoveredNodeId = nodeIdUnderFlowPointerForPreview(pointer, context);
  if (!hoveredNodeId || hoveredNodeId === connection.fromNode.id) {
    return connection.toNode?.id ?? null;
  }
  return hoveredNodeId;
}

function buildHandlePreviewConnection(
  connection: FlowConnectionLike
): Connection | null {
  if (
    connection.fromNode &&
    connection.toNode &&
    connection.fromHandle?.id &&
    connection.toHandle?.id
  ) {
    return {
      source: connection.fromNode.id,
      target: connection.toNode.id,
      sourceHandle: connection.fromHandle.id,
      targetHandle: connection.toHandle.id,
    };
  }
  return null;
}

function buildCardDropPreviewConnection(
  connection: FlowConnectionLike,
  snap: GenerativePreviewSnap | null
): Connection | null {
  if (!snap || !connection.fromNode?.id || !connection.fromHandle?.id) {
    return null;
  }
  return {
    source: connection.fromNode.id,
    sourceHandle: connection.fromHandle.id,
    target: snap.nodeId,
    targetHandle: snap.targetHandle,
  };
}

/** Card-border snap while hovering an AI text / AI image card (valid or invalid). */
export function resolveGenerativeCardSnapUnderPointer(
  connection: FlowConnectionLike,
  nodeLookup: Map<string, InternalNode<Node>>,
  context: AiTextConnectionContext
): GenerativePreviewSnap | null {
  if (!connection.inProgress || !connection.fromNode || !connection.fromHandle) {
    return null;
  }

  const pointer = connectionPointer(connection);
  if (!pointer) return null;

  const hoveredNodeId = nodeIdUnderFlowPointerForPreview(pointer, context);
  if (!hoveredNodeId || hoveredNodeId === connection.fromNode.id) {
    return null;
  }

  const hoveredType = readNodeType(nodeLookup.get(hoveredNodeId));
  if (!isGenerativeNodeType(hoveredType)) return null;

  const hoveredNode = nodeLookup.get(hoveredNodeId);
  if (!hoveredNode || !hoveredType) return null;

  const fromNodeType = readNodeType(connection.fromNode);
  const isIncomingReference =
    isIncomingAiTextReferenceConnection(connection) ||
    isIncomingAiImageReferenceConnection(connection);

  if (isIncomingReference) {
    return snapFromGenerativeReferenceTarget(
      hoveredNode,
      hoveredType,
      fromNodeType
    );
  }

  if (isIncomingGenerativeOutputPick(connection)) {
    return snapFromGenerativeOutputTarget(hoveredNode, hoveredType);
  }

  return null;
}

/** Resolve card-drop preview for AI text / AI image (valid or invalid — same snap target). */
export function resolveGenerativePreviewConnection(
  connection: FlowConnectionLike,
  nodeLookup: Map<string, InternalNode<Node>>,
  context: AiTextConnectionContext,
  _edges: readonly {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }[]
): GenerativePreviewConnection | null {
  if (!connection.inProgress || !connection.fromNode || !connection.fromHandle) {
    return null;
  }

  const pointer = connectionPointer(connection);
  if (!pointer) return null;

  const fromNodeType = readNodeType(connection.fromNode);
  const policyNodes = Array.from(nodeLookup.values()).map((node) => ({
    id: node.id,
    data: node.data as WorkflowNodeType,
  }));

  const hoveredNodeId = resolveHoveredGenerativeNodeId(connection, context);
  if (!hoveredNodeId || hoveredNodeId === connection.fromNode.id) {
    return null;
  }

  const hoveredType = readNodeType(nodeLookup.get(hoveredNodeId));
  const isIncomingReference =
    isIncomingAiTextReferenceConnection(connection) ||
    isIncomingAiImageReferenceConnection(connection);

  if (!isIncomingReference) {
    if (
      isIncomingGenerativeOutputPick(connection) &&
      connection.fromHandle?.id &&
      hoveredType === AI_TEXT_NODE_TYPE
    ) {
      const targetNode = nodeLookup.get(hoveredNodeId);
      if (!targetNode) return null;

      const snap = snapFromGenerativeOutputTarget(targetNode, hoveredType);
      if (!snap) return null;

      return {
        connection: {
          source: connection.fromNode.id,
          sourceHandle: connection.fromHandle.id,
          target: hoveredNodeId,
          targetHandle: snap.targetHandle,
        },
        snap,
      };
    }
    return null;
  }

  if (!isGenerativeNodeType(hoveredType)) {
    return null;
  }

  const drop =
    buildAiTextReferenceConnectionFromCardDrop({
      dragFromNodeId: connection.fromNode.id,
      dragFromHandle: connection.fromHandle,
      hoveredNodeId,
      nodes: policyNodes,
    }) ??
    buildAiImageReferenceConnectionFromCardDrop({
      dragFromNodeId: connection.fromNode.id,
      dragFromHandle: connection.fromHandle,
      hoveredNodeId,
      nodes: policyNodes,
    });

  if (!drop) return null;

  const targetNode = nodeLookup.get(drop.target);
  if (!targetNode) return null;

  const targetType = readNodeType(targetNode) ?? hoveredType;
  const snap = snapFromGenerativeReferenceTarget(
    targetNode,
    targetType,
    fromNodeType
  );
  if (!snap) return null;

  return {
    connection: {
      source: drop.source,
      target: drop.target,
      sourceHandle: drop.sourceHandle,
      targetHandle: drop.targetHandle,
    },
    snap,
  };
}

/** Shared drag preview: snap target, connection payload, and validity (green vs red line). */
export function buildGenerativeDragPreviewState(
  connection: FlowConnectionLike,
  nodeLookup: Map<string, InternalNode<Node>>,
  context: AiTextConnectionContext,
  edges: readonly {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }[],
  validate: (connection: Connection) => boolean
): GenerativeDragPreviewState {
  const generativePreview = resolveGenerativePreviewConnection(
    connection,
    nodeLookup,
    context,
    edges
  );
  const snap =
    generativePreview?.snap ??
    resolveGenerativeCardSnapUnderPointer(connection, nodeLookup, context);

  const previewConnection =
    generativePreview?.connection ??
    buildCardDropPreviewConnection(connection, snap) ??
    buildHandlePreviewConnection(connection);

  if (!previewConnection) {
    return { previewConnection: null, snap, previewAllowed: null };
  }

  return {
    previewConnection,
    snap,
    previewAllowed: validate(previewConnection),
  };
}
