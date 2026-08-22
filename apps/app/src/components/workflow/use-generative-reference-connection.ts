import type { Connection, Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import { useNodes, useReactFlow } from "@xyflow/react";
import { useCallback } from "react";

import { useObjectService } from "@/services/object-service";

import {
  appendGenerativeReferenceConnection,
  buildPanelReferenceConnection,
  canConnectGenerativeReferenceConnection,
} from "./generative-reference-connection";
import { useWorkflow, useWorkflowActions } from "./workflow-context";

import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface GenerativeReferenceConnectionSnapshot {
  readonly nodes?: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly edges?: readonly ReactFlowEdge<WorkflowEdgeType>[];
}

export function useGenerativeReferenceConnection() {
  const { setEdges } = useReactFlow();
  const nodes = useNodes();
  const { edges, disabled } = useWorkflow();
  const { generativeReferenceCatalogs } = useWorkflowActions();
  const { createObjectUrl } = useObjectService();

  const canConnectReference = useCallback(
    (sourceNodeId: string, sourceHandle: string, targetNodeId: string) =>
      canConnectGenerativeReferenceConnection({
        sourceNodeId,
        sourceHandle,
        targetNodeId,
        nodes,
        edges,
        generativeReferenceCatalogs,
        disabled,
      }),
    [disabled, edges, generativeReferenceCatalogs, nodes]
  );

  const buildReferenceConnection = useCallback(
    (sourceNodeId: string, sourceHandle: string, targetNodeId: string) =>
      buildPanelReferenceConnection({
        sourceNodeId,
        sourceHandle,
        targetNodeId,
        nodes,
      }),
    [nodes]
  );

  const appendReferenceConnection = useCallback(
    (
      connection: Connection,
      snapshot?: GenerativeReferenceConnectionSnapshot
    ) =>
      appendGenerativeReferenceConnection({
        connection,
        nodes: snapshot?.nodes ?? nodes,
        edges: snapshot?.edges ?? edges,
        setEdges,
        createObjectUrl,
        generativeReferenceCatalogs,
        disabled,
      }),
    [
      createObjectUrl,
      disabled,
      edges,
      generativeReferenceCatalogs,
      nodes,
      setEdges,
    ]
  );

  return {
    canConnectReference,
    buildReferenceConnection,
    appendReferenceConnection,
  };
}
