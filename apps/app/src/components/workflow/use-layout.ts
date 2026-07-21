import dagre from "@dagrejs/dagre";
import type {
  Edge as ReactFlowEdge,
  ReactFlowInstance,
  Node as ReactFlowNode,
} from "@xyflow/react";
import { useCallback } from "react";

import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";
import {
  resolveWorkflowNodeDimensions,
  WORKFLOW_NODE_GAP_PX,
} from "./workflow-node-placement";

interface UseLayoutProps {
  nodesRef: React.RefObject<ReactFlowNode<WorkflowNodeType>[]>;
  edgesRef: React.RefObject<ReactFlowEdge<WorkflowEdgeType>[]>;
  setNodes: React.Dispatch<
    React.SetStateAction<ReactFlowNode<WorkflowNodeType>[]>
  >;
  reactFlowInstance: ReactFlowInstance<
    ReactFlowNode<WorkflowNodeType>,
    ReactFlowEdge<WorkflowEdgeType>
  > | null;
  disabled: boolean;
}

interface UseLayoutReturn {
  applyLayout: () => void;
}

export function useLayout({
  nodesRef,
  edgesRef,
  setNodes,
  reactFlowInstance,
  disabled,
}: UseLayoutProps): UseLayoutReturn {
  const applyLayout = useCallback(() => {
    if (disabled) return;

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: "LR",
      nodesep: WORKFLOW_NODE_GAP_PX,
      ranksep: WORKFLOW_NODE_GAP_PX,
    });

    nodesRef.current.forEach((node) => {
      const { width, height } = resolveWorkflowNodeDimensions(
        node.data.nodeType,
        node
      );
      dagreGraph.setNode(node.id, { width, height });
    });

    edgesRef.current.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    setNodes((nds) =>
      nds.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        if (!nodeWithPosition) return node;
        const { width, height } = resolveWorkflowNodeDimensions(
          node.data.nodeType,
          node
        );
        const x = nodeWithPosition.x - width / 2;
        const y = nodeWithPosition.y - height / 2;

        return {
          ...node,
          position: { x, y },
        };
      })
    );
    reactFlowInstance?.fitView({ duration: 200 });
  }, [setNodes, disabled, reactFlowInstance, nodesRef, edgesRef]);

  return { applyLayout };
}
