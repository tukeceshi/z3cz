import type {
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "@xyflow/react";
import { useEffect, useRef } from "react";

import { stripTransientGenerativeMetadata } from "./generative-card-error-utils";
import { snapshotGenerativeProgressForPersist } from "./generative-progress-utils";
import { stripWorkflowNodeCanvasUi } from "./workflow-node-canvas-ui";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

const PERSIST_DEBOUNCE_MS = 0;

const stripExecutionFields = (
  data: WorkflowNodeType
): Omit<WorkflowNodeType, "executionState" | "error"> & {
  outputs: Omit<WorkflowNodeType["outputs"][number], "value">[];
  inputs: WorkflowNodeType["inputs"];
} => {
  const { executionState, error, metadata: _metadata, ...rest } = data;
  const metadata = stripTransientGenerativeMetadata(data.metadata);
  const persistable = stripWorkflowNodeCanvasUi(rest);

  return {
    ...persistable,
    ...(metadata ? { metadata } : {}),
    outputs: data.outputs.map(({ value, ...outputRest }) => outputRest),
    inputs: data.inputs,
  };
};

const stripEdgeExecutionFields = (
  data: WorkflowEdgeType = {}
): Omit<WorkflowEdgeType, "isActive"> => {
  const { isActive, ...rest } = data;
  return rest;
};

interface UseGraphPersistenceProps {
  nodes: ReactFlowNode<WorkflowNodeType>[];
  edges: ReactFlowEdge<WorkflowEdgeType>[];
  disabled: boolean;
  isDraggingRef: React.RefObject<boolean>;
  onNodesChangePersist?: (nodes: ReactFlowNode<WorkflowNodeType>[]) => void;
  onEdgesChangePersist?: (edges: ReactFlowEdge<WorkflowEdgeType>[]) => void;
}

export function useGraphPersistence({
  nodes,
  edges,
  disabled,
  isDraggingRef,
  onNodesChangePersist,
  onEdgesChangePersist,
}: UseGraphPersistenceProps): void {
  const lastPersistedNodesRef = useRef<string>("");
  const lastPersistedEdgesRef = useRef<string>("");
  const lastPersistedProgressRef = useRef<string>("");
  const nodesPersistTimerRef = useRef<number | null>(null);
  const edgesPersistTimerRef = useRef<number | null>(null);
  const pendingNodesRef = useRef<ReactFlowNode<WorkflowNodeType>[]>(nodes);
  const pendingEdgesRef = useRef<ReactFlowEdge<WorkflowEdgeType>[]>(edges);

  const persistNodesNow = () => {
    const normalizedNodes = pendingNodesRef.current.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: stripExecutionFields(node.data),
    }));

    const serialized = JSON.stringify(normalizedNodes);
    if (serialized !== lastPersistedNodesRef.current) {
      lastPersistedNodesRef.current = serialized;
      onNodesChangePersist?.(pendingNodesRef.current);
    }
    lastPersistedProgressRef.current = snapshotGenerativeProgressForPersist(
      pendingNodesRef.current
    );
  };

  useEffect(() => {
    pendingNodesRef.current = nodes;
    if (disabled || isDraggingRef.current) {
      return;
    }

    const progressSnapshot = snapshotGenerativeProgressForPersist(nodes);

    if (nodesPersistTimerRef.current !== null) {
      window.clearTimeout(nodesPersistTimerRef.current);
      nodesPersistTimerRef.current = null;
    }

    if (lastPersistedProgressRef.current === "") {
      lastPersistedProgressRef.current = progressSnapshot;
    } else if (progressSnapshot !== lastPersistedProgressRef.current) {
      persistNodesNow();
      return;
    }

    nodesPersistTimerRef.current = window.setTimeout(() => {
      nodesPersistTimerRef.current = null;
      persistNodesNow();
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (nodesPersistTimerRef.current !== null) {
        window.clearTimeout(nodesPersistTimerRef.current);
      }
    };
  }, [nodes, onNodesChangePersist, disabled, isDraggingRef]);

  useEffect(() => {
    pendingEdgesRef.current = edges;
    if (disabled) {
      return;
    }

    if (edgesPersistTimerRef.current !== null) {
      window.clearTimeout(edgesPersistTimerRef.current);
    }

    edgesPersistTimerRef.current = window.setTimeout(() => {
      edgesPersistTimerRef.current = null;
      const normalizedEdges = pendingEdgesRef.current.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
        data: stripEdgeExecutionFields(edge.data),
      }));

      const serialized = JSON.stringify(normalizedEdges);
      if (serialized !== lastPersistedEdgesRef.current) {
        lastPersistedEdgesRef.current = serialized;
        onEdgesChangePersist?.(pendingEdgesRef.current);
      }
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (edgesPersistTimerRef.current !== null) {
        window.clearTimeout(edgesPersistTimerRef.current);
      }
    };
  }, [edges, onEdgesChangePersist, disabled]);
}
