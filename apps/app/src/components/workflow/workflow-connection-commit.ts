import type { ObjectReference } from "@dafthunk/types";
import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import type { Connection, Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import {
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
} from "./ai-image-node-utils";
import {
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
} from "./ai-video-node-utils";
import {
  edgeTouchesInputHandle,
  resolveConnectionEndpoints,
  validateWorkflowConnection,
  type ValidateWorkflowConnectionParams,
} from "./workflow-connection-validation";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface PrepareWorkflowConnectionAppendParams {
  readonly connection: Connection;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
  readonly generativeReferenceCatalogs?: ValidateWorkflowConnectionParams["generativeReferenceCatalogs"];
  readonly extraValidate?: (connection: Connection) => boolean;
  readonly disabled?: boolean;
}

export interface PreparedWorkflowConnectionAppend {
  readonly edge: ReactFlowEdge<WorkflowEdgeType>;
  readonly inputNodeId: string;
  readonly inputHandleId: string;
  readonly acceptsMultipleConnections: boolean;
}

function normalizeGenerativeConnection(
  connection: Connection,
  sourceNode: ReactFlowNode<WorkflowNodeType>,
  targetNode: ReactFlowNode<WorkflowNodeType>
): Connection {
  if (
    targetNode.data.nodeType === AI_IMAGE_NODE_TYPE &&
    connection.targetHandle === AI_IMAGE_REFERENCE_HANDLE_ID &&
    sourceNode.data.nodeType === AI_TEXT_NODE_TYPE
  ) {
    return { ...connection, targetHandle: AI_IMAGE_PROMPT_HANDLE_ID };
  }

  if (
    targetNode.data.nodeType === AI_VIDEO_NODE_TYPE &&
    connection.targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID &&
    sourceNode.data.nodeType === AI_TEXT_NODE_TYPE
  ) {
    return { ...connection, targetHandle: AI_VIDEO_PROMPT_HANDLE_ID };
  }

  return connection;
}

/** Validate and build a workflow edge using an explicit node/edge snapshot. */
export function prepareWorkflowConnectionAppend(
  params: PrepareWorkflowConnectionAppendParams
): PreparedWorkflowConnectionAppend | null {
  if (
    !validateWorkflowConnection({
      connection: params.connection,
      nodes: params.nodes,
      edges: params.edges,
      generativeReferenceCatalogs: params.generativeReferenceCatalogs,
      extraValidate: params.extraValidate,
      disabled: params.disabled,
    })
  ) {
    return null;
  }

  const sourceNode = params.nodes.find(
    (node) => node.id === params.connection.source
  );
  const targetNode = params.nodes.find(
    (node) => node.id === params.connection.target
  );
  if (!sourceNode || !targetNode) {
    return null;
  }

  const normalizedConnection = normalizeGenerativeConnection(
    params.connection,
    sourceNode,
    targetNode
  );

  const endpoints = resolveConnectionEndpoints(
    normalizedConnection,
    sourceNode,
    targetNode
  );
  if (!endpoints) {
    return null;
  }

  const { inputNodeId, inputHandleId, inputParam } = endpoints;

  return {
    edge: {
      ...normalizedConnection,
      id: `${normalizedConnection.source}-${normalizedConnection.sourceHandle}-${normalizedConnection.target}-${normalizedConnection.targetHandle}-${Date.now()}`,
      type: "workflowEdge",
      data: {
        isValid: true,
        isActive: false,
        sourceType: normalizedConnection.sourceHandle ?? undefined,
        targetType: normalizedConnection.targetHandle ?? undefined,
        createObjectUrl: params.createObjectUrl,
      },
      zIndex: 0,
    },
    inputNodeId,
    inputHandleId,
    acceptsMultipleConnections: Boolean(inputParam.repeated),
  };
}

export function mergePreparedWorkflowEdge(
  currentEdges: readonly ReactFlowEdge<WorkflowEdgeType>[],
  prepared: PreparedWorkflowConnectionAppend
): ReactFlowEdge<WorkflowEdgeType>[] {
  let filteredEdges = currentEdges;

  if (!prepared.acceptsMultipleConnections) {
    filteredEdges = currentEdges.filter(
      (edge) =>
        !edgeTouchesInputHandle(
          edge,
          prepared.inputNodeId,
          prepared.inputHandleId
        )
    );
  }

  return [
    ...filteredEdges.map((edge) => ({ ...edge, zIndex: 0 })),
    prepared.edge,
  ];
}
