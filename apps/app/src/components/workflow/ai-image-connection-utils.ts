import { AI_IMAGE_NODE_TYPE } from "@dafthunk/types";
import {
  type Edge as ReactFlowEdge,
  type InternalNode,
  type Node,
  type Transform,
} from "@xyflow/react";
import {
  AI_IMAGE_CARD_HEIGHT_PX,
  AI_IMAGE_CARD_WIDTH_PX,
  AI_IMAGE_OUTPUT_ID,
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
  isAiImageAllowedReferenceNodeType,
} from "./ai-image-node-utils";
import type { WorkflowEdgeType } from "./workflow-types";

type AiImageReferenceEdge = Pick<
  ReactFlowEdge<WorkflowEdgeType>,
  "source" | "target" | "sourceHandle" | "targetHandle"
>;

interface AiImageConnectionContext {
  readonly domNode: HTMLDivElement | null;
  readonly transform: Transform;
}

interface AiImageSnapTarget {
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

function nodeFlowSize(node: InternalNode<Node>): {
  width: number;
  height: number;
} {
  const nodeType = (node.data as { nodeType?: string } | undefined)?.nodeType;
  if (nodeType === AI_IMAGE_NODE_TYPE) {
    return {
      width: AI_IMAGE_CARD_WIDTH_PX,
      height: AI_IMAGE_CARD_HEIGHT_PX,
    };
  }
  return {
    width: node.measured?.width ?? node.width ?? AI_IMAGE_CARD_WIDTH_PX,
    height: node.measured?.height ?? node.height ?? AI_IMAGE_CARD_HEIGHT_PX,
  };
}

function connectionPointer(
  connection: FlowConnection
): { x: number; y: number } | null {
  if (connection.pointer) return connection.pointer;
  if (connection.to) return connection.to;
  return null;
}

function nodeIdUnderFlowPointer(
  client: { x: number; y: number },
  context: AiImageConnectionContext
): string | null {
  if (!context.domNode) return null;
  const bounds = context.domNode.getBoundingClientRect();
  const x = (client.x - bounds.left - context.transform[0]) / context.transform[2];
  const y = (client.y - bounds.top - context.transform[1]) / context.transform[2];

  const stack = document.elementsFromPoint(client.x, client.y);
  for (const el of stack) {
    const nodeEl = el.closest(".react-flow__node") as HTMLElement | null;
    const nodeId = nodeEl?.getAttribute("data-id");
    if (nodeId) return nodeId;
  }

  void x;
  void y;
  return null;
}

function isAiImageTargetNode(node: InternalNode<Node>): boolean {
  return (
    (node.data as { nodeType?: string } | undefined)?.nodeType ===
    AI_IMAGE_NODE_TYPE
  );
}

function isIncomingAiImageReferenceConnection(
  connection: FlowConnection
): boolean {
  if (!connection.inProgress || !connection.fromNode) return false;
  const fromType = (
    connection.fromNode.data as { nodeType?: string } | undefined
  )?.nodeType;
  const fromHandle = connection.fromHandle?.id;
  return (
    fromHandle === AI_IMAGE_OUTPUT_ID &&
    isAiImageAllowedReferenceNodeType(fromType)
  );
}

function isAllowedAiImageOutputTarget(
  connection: FlowConnection,
  targetId: string,
  nodeLookup: Map<string, InternalNode<Node>>
): boolean {
  const targetNode = nodeLookup.get(targetId);
  if (!targetNode || !isAiImageTargetNode(targetNode)) return false;
  if (connection.fromNode?.id === targetId) return false;

  const fromHandle = connection.fromHandle?.id;
  const fromType = (
    connection.fromNode?.data as { nodeType?: string } | undefined
  )?.nodeType;

  return (
    fromHandle === AI_IMAGE_OUTPUT_ID &&
    isAiImageAllowedReferenceNodeType(fromType)
  );
}

function isAiImageValidHighlightTarget(
  connection: FlowConnection,
  targetId: string,
  nodeLookup: Map<string, InternalNode<Node>>
): boolean {
  const targetNode = nodeLookup.get(targetId);
  if (!targetNode || !isAiImageTargetNode(targetNode)) return false;

  if (isIncomingAiImageReferenceConnection(connection)) {
    return isAllowedAiImageOutputTarget(connection, targetId, nodeLookup);
  }

  return false;
}

function aiImageSnapFromNode(node: InternalNode<Node>): AiImageSnapTarget {
  const pos = node.internals.positionAbsolute;
  const { height } = nodeFlowSize(node);
  return {
    nodeId: node.id,
    x: pos.x,
    y: pos.y + height / 2,
  };
}

export function findAiImageConnectionTargetNodeId(
  connection: FlowConnection,
  nodeLookup: Map<string, InternalNode<Node>>,
  context: AiImageConnectionContext,
  _edges: readonly AiImageReferenceEdge[]
): string | null {
  if (!connection.inProgress || !connection.fromNode) return null;

  const pointer = connectionPointer(connection);
  if (!pointer) return null;

  const resolveTarget = (targetId: string | null | undefined): string | null => {
    if (!targetId || targetId === connection.fromNode?.id) return null;
    if (!isAiImageValidHighlightTarget(connection, targetId, nodeLookup)) {
      return null;
    }
    return targetId;
  };

  const nodeIdUnderPointer = nodeIdUnderFlowPointer(pointer, context);
  const fromPointer = resolveTarget(nodeIdUnderPointer);
  if (fromPointer) return fromPointer;

  return resolveTarget(connection.toNode?.id);
}

export function findAiImageConnectionSnap(
  connection: FlowConnection,
  nodeLookup: Map<string, InternalNode<Node>>,
  context: AiImageConnectionContext,
  edges: readonly AiImageReferenceEdge[]
): AiImageSnapTarget | null {
  if (!connection.inProgress || !connection.fromNode) return null;
  if (!isIncomingAiImageReferenceConnection(connection)) return null;

  const targetId = findAiImageConnectionTargetNodeId(
    connection,
    nodeLookup,
    context,
    edges
  );
  if (!targetId) return null;

  const node = nodeLookup.get(targetId);
  if (!node) return null;
  return aiImageSnapFromNode(node);
}

export function snapAiImageReferenceBorderPoint(
  node: InternalNode<Node>
): { x: number; y: number } {
  const pos = node.internals.positionAbsolute;
  const { height } = nodeFlowSize(node);
  return { x: pos.x, y: pos.y + height / 2 };
}

export function snapAiImageOutputBorderPoint(
  node: InternalNode<Node>
): { x: number; y: number } {
  const pos = node.internals.positionAbsolute;
  const { width, height } = nodeFlowSize(node);
  return { x: pos.x + width, y: pos.y + height / 2 };
}

export function isAiImageInboundReferenceEdge(params: {
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
    targetHandle === AI_IMAGE_REFERENCE_HANDLE_ID ||
    targetHandle === AI_IMAGE_PROMPT_HANDLE_ID
  ) {
    return true;
  }

  const targetNode = params.nodeLookup.get(params.target);
  const sourceNode = params.nodeLookup.get(params.source);
  const targetType = (targetNode?.data as { nodeType?: string } | undefined)
    ?.nodeType;
  const sourceType = (sourceNode?.data as { nodeType?: string } | undefined)
    ?.nodeType;

  if (targetType !== AI_IMAGE_NODE_TYPE) {
    return false;
  }

  return isAiImageAllowedReferenceNodeType(sourceType);
}
