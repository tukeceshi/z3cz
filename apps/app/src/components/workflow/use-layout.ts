import type {
  Edge as ReactFlowEdge,
  ReactFlowInstance,
  Node as ReactFlowNode,
} from "@xyflow/react";
import { useCallback } from "react";

import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";
import { resolveWorkflowNodeDimensions } from "./workflow-node-placement";
import { computeWorkflowOrganizeLayoutUpdates } from "./workflow-organize-layout";

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
  onBeforeLayout?: () => void;
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
  onBeforeLayout,
}: UseLayoutProps): UseLayoutReturn {
  const applyLayout = useCallback(() => {
    if (disabled) return;

    onBeforeLayout?.();

    const layoutNodes = reactFlowInstance?.getNodes() ?? nodesRef.current;

    void computeWorkflowOrganizeLayoutUpdates(
      layoutNodes,
      edgesRef.current,
      (node) =>
        resolveWorkflowNodeDimensions(node.data.nodeType, node)
    ).then((updates) => {
      if (updates.length === 0) {
        reactFlowInstance?.fitView({ duration: 200 });
        return;
      }

      const updatesById = new Map(
        updates.map((update) => [update.id, update.position] as const)
      );

      setNodes((nds) =>
        nds.map((node) => {
          const position = updatesById.get(node.id);
          if (!position) return node;
          return {
            ...node,
            position,
          };
        })
      );

      requestAnimationFrame(() => {
        reactFlowInstance?.fitView({ duration: 200 });
      });
    });
  }, [disabled, onBeforeLayout, reactFlowInstance, nodesRef, edgesRef, setNodes]);

  return { applyLayout };
}
