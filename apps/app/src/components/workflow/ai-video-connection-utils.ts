import { AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import {
  type Edge as ReactFlowEdge,
  type InternalNode,
  type Node,
  type Transform,
} from "@xyflow/react";
import {
  AI_VIDEO_OUTPUT_ID,
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
  classifyAiVideoReferenceFromNodeType,
  isAiVideoAllowedReferenceNodeType,
} from "./ai-video-node-utils";
import { AI_AUDIO_OUTPUT_ID } from "./ai-audio-node-utils";
import { AI_IMAGE_OUTPUT_ID } from "./ai-image-node-utils";
import { nodeIdUnderPanePointer } from "./connection-pane-hit-test";
import {
  snapGenerativeContentBorderPoint,
} from "./generative-node-content-geometry";
import type { WorkflowEdgeType } from "./workflow-types";

type AiVideoReferenceEdge = Pick<
  ReactFlowEdge<WorkflowEdgeType>,
  "source" | "target" | "sourceHandle" | "targetHandle"
>;

interface AiVideoConnectionContext {
  readonly domNode: HTMLDivElement | null;
  readonly transform: Transform;
}

interface AiVideoSnapTarget {
  readonly nodeId: string;
  readonly x: number;
  readonly y: number;
}

interface FlowConnection {
  readonly inProgress: boolean;
  readonly fromNode: InternalNode<Node> | null;
  readonly fromHandle: { readonly type: string; readonly id?: string | null } | null;
  readonly to: { readonly x: number; readonly y: number } | null;
  readonly toNode?: InternalNode<Node> | null;
  readonly pointer?: { readonly x: number; readonly y: number } | null;
}

function connectionPointer(
  connection: FlowConnection
): { x: number; y: number } | null {
  if (connection.pointer) return connection.pointer;
  if (connection.to) return connection.to;
  return null;
}

function nodeIdUnderFlowPointer(
  panePointer: { x: number; y: number },
  context: AiVideoConnectionContext
): string | null {
  return nodeIdUnderPanePointer(panePointer, { domNode: context.domNode });
}

function isAiVideoTargetNode(node: InternalNode<Node>): boolean {
  return (
    (node.data as { nodeType?: string } | undefined)?.nodeType ===
    AI_VIDEO_NODE_TYPE
  );
}

function expectedReferenceSourceHandle(
  fromType: string | undefined
): string | null {
  const kind = classifyAiVideoReferenceFromNodeType(fromType);
  if (kind === "image") return AI_IMAGE_OUTPUT_ID;
  if (kind === "video") return AI_VIDEO_OUTPUT_ID;
  if (kind === "audio") return AI_AUDIO_OUTPUT_ID;
  return null;
}

function isIncomingAiVideoReferenceConnection(
  connection: FlowConnection
): boolean {
  if (!connection.inProgress || !connection.fromNode) return false;
  const fromType = (
    connection.fromNode.data as { nodeType?: string } | undefined
  )?.nodeType;
  const expectedHandle = expectedReferenceSourceHandle(fromType);
  const fromHandle = connection.fromHandle?.id;
  return (
    !!expectedHandle &&
    fromHandle === expectedHandle &&
    isAiVideoAllowedReferenceNodeType(fromType)
  );
}

function isAllowedAiVideoOutputTarget(
  connection: FlowConnection,
  targetId: string,
  nodeLookup: Map<string, InternalNode<Node>>
): boolean {
  const targetNode = nodeLookup.get(targetId);
  if (!targetNode || !isAiVideoTargetNode(targetNode)) return false;
  if (connection.fromNode?.id === targetId) return false;

  const fromHandle = connection.fromHandle?.id;
  const fromType = (
    connection.fromNode?.data as { nodeType?: string } | undefined
  )?.nodeType;
  const expectedHandle = expectedReferenceSourceHandle(fromType);

  return (
    !!expectedHandle &&
    fromHandle === expectedHandle &&
    isAiVideoAllowedReferenceNodeType(fromType)
  );
}

function isAiVideoValidHighlightTarget(
  connection: FlowConnection,
  targetId: string,
  nodeLookup: Map<string, InternalNode<Node>>
): boolean {
  const targetNode = nodeLookup.get(targetId);
  if (!targetNode || !isAiVideoTargetNode(targetNode)) return false;

  if (isIncomingAiVideoReferenceConnection(connection)) {
    return isAllowedAiVideoOutputTarget(connection, targetId, nodeLookup);
  }

  return false;
}

function aiVideoSnapFromNode(node: InternalNode<Node>): AiVideoSnapTarget {
  const point = snapGenerativeContentBorderPoint(node, "left");
  return {
    nodeId: node.id,
    x: point.x,
    y: point.y,
  };
}

export function findAiVideoConnectionTargetNodeId(
  connection: FlowConnection,
  nodeLookup: Map<string, InternalNode<Node>>,
  context: AiVideoConnectionContext,
  _edges: readonly AiVideoReferenceEdge[]
): string | null {
  if (!connection.inProgress || !connection.fromNode) return null;

  const pointer = connectionPointer(connection);
  if (!pointer) return null;

  const resolveTarget = (targetId: string | null | undefined): string | null => {
    if (!targetId || targetId === connection.fromNode?.id) return null;
    if (!isAiVideoValidHighlightTarget(connection, targetId, nodeLookup)) {
      return null;
    }
    return targetId;
  };

  return resolveTarget(nodeIdUnderFlowPointer(pointer, context));
}

export function findAiVideoConnectionSnap(
  connection: FlowConnection,
  nodeLookup: Map<string, InternalNode<Node>>,
  context: AiVideoConnectionContext,
  edges: readonly AiVideoReferenceEdge[]
): AiVideoSnapTarget | null {
  if (!connection.inProgress || !connection.fromNode) return null;
  if (!isIncomingAiVideoReferenceConnection(connection)) return null;

  const targetId = findAiVideoConnectionTargetNodeId(
    connection,
    nodeLookup,
    context,
    edges
  );
  if (!targetId) return null;

  const node = nodeLookup.get(targetId);
  if (!node) return null;
  return aiVideoSnapFromNode(node);
}

export function snapAiVideoReferenceBorderPoint(
  node: InternalNode<Node>
): { x: number; y: number } {
  return snapGenerativeContentBorderPoint(node, "left");
}

export function snapAiVideoOutputBorderPoint(
  node: InternalNode<Node>
): { x: number; y: number } {
  return snapGenerativeContentBorderPoint(node, "right");
}

export function isAiVideoInboundReferenceEdge(params: {
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

  const targetHandle =
    params.targetHandle ?? params.dataTargetHandle ?? undefined;
  if (
    targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID ||
    targetHandle === AI_VIDEO_PROMPT_HANDLE_ID
  ) {
    return true;
  }

  const targetNode = params.nodeLookup.get(params.target);
  const sourceNode = params.nodeLookup.get(params.source);
  const targetType = (targetNode?.data as { nodeType?: string } | undefined)
    ?.nodeType;
  const sourceType = (sourceNode?.data as { nodeType?: string } | undefined)
    ?.nodeType;

  if (targetType !== AI_VIDEO_NODE_TYPE) {
    return false;
  }

  return isAiVideoAllowedReferenceNodeType(sourceType);
}
