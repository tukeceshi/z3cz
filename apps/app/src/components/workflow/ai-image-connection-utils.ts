import { AI_IMAGE_NODE_TYPE } from "@dafthunk/types";
import {
  type Edge as ReactFlowEdge,
  type InternalNode,
  type Node,
  type Transform,
} from "@xyflow/react";
import {
  AI_IMAGE_OUTPUT_ID,
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
  isAiImageAllowedReferenceNodeType,
} from "./ai-image-node-utils";
import { nodeIdUnderPanePointer } from "./connection-pane-hit-test";
import {
  snapGenerativeContentBorderPoint,
} from "./generative-node-content-geometry";
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

function connectionPointer(
  connection: FlowConnection
): { x: number; y: number } | null {
  if (connection.pointer) return connection.pointer;
  if (connection.to) return connection.to;
  return null;
}

function nodeIdUnderFlowPointer(
  panePointer: { x: number; y: number },
  context: AiImageConnectionContext
): string | null {
  return nodeIdUnderPanePointer(panePointer, { domNode: context.domNode });
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
  const point = snapGenerativeContentBorderPoint(node, "left");
  return {
    nodeId: node.id,
    x: point.x,
    y: point.y,
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

  return resolveTarget(nodeIdUnderFlowPointer(pointer, context));
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
  return snapGenerativeContentBorderPoint(node, "left");
}

export function snapAiImageOutputBorderPoint(
  node: InternalNode<Node>
): { x: number; y: number } {
  return snapGenerativeContentBorderPoint(node, "right");
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
