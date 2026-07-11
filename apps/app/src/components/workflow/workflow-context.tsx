import type { WorkflowTrigger } from "@dafthunk/types";
import type { Edge as ReactFlowEdge } from "@xyflow/react";
import { createContext, ReactNode, useContext, useMemo } from "react";

import {
  NodeType,
  WorkflowEdgeType,
  WorkflowNodeType,
  WorkflowParameter,
} from "./workflow-types";

type UpdateNodeFn = (nodeId: string, data: Partial<WorkflowNodeType>) => void;

// Extends UpdateNodeFn with functional updater support (like React's setState)
type UpdateNodeDataFn = (
  nodeId: string,
  data:
    | Partial<WorkflowNodeType>
    | ((current: WorkflowNodeType) => Partial<WorkflowNodeType>)
) => void;
type UpdateEdgeFn = (edgeId: string, data: Partial<WorkflowEdgeType>) => void;
type DeleteEdgeFn = (edgeId: string) => void;
/** Called when the user requests a single-node run from the AI config panel. */
type RunNodeFn = (nodeId: string) => Promise<void>;

export interface WorkflowContextProps {
  updateNodeData?: UpdateNodeDataFn;
  updateEdgeData?: UpdateEdgeFn;
  deleteEdge?: DeleteEdgeFn;
  edges?: ReactFlowEdge<WorkflowEdgeType>[];
  connectedHandles?: ReadonlySet<string>;
  soleSelectedNodeId?: string | null;
  disabled?: boolean;
  expandedOutputs?: boolean;
  nodeTypes?: NodeType[];
  workflowTrigger?: WorkflowTrigger;
  onRunNode?: RunNodeFn;
}

export function isWorkflowHandleConnected(
  connectedHandles: ReadonlySet<string>,
  nodeId: string,
  handleId: string
): boolean {
  return connectedHandles.has(`${nodeId}:${handleId}`);
}

// Create the context with a default value
const WorkflowContext = createContext<WorkflowContextProps>({
  updateNodeData: () => {},
  updateEdgeData: () => {},
  deleteEdge: () => {},
  edges: [],
  connectedHandles: new Set(),
  soleSelectedNodeId: null,
  disabled: false,
  nodeTypes: [],
});

// Custom hook for using the workflow context
export const useWorkflow = () => useContext(WorkflowContext);

export interface WorkflowProviderProps {
  readonly children: ReactNode;
  readonly updateNodeData?: UpdateNodeDataFn;
  readonly updateEdgeData?: UpdateEdgeFn;
  readonly deleteEdge?: DeleteEdgeFn;
  readonly edges?: ReactFlowEdge<WorkflowEdgeType>[];
  readonly connectedHandles?: ReadonlySet<string>;
  readonly soleSelectedNodeId?: string | null;
  readonly disabled?: boolean;
  readonly expandedOutputs?: boolean;
  readonly nodeTypes?: NodeType[];
  readonly workflowTrigger?: WorkflowTrigger;
  readonly onRunNode?: RunNodeFn;
}

export function WorkflowProvider({
  children,
  updateNodeData = () => {},
  updateEdgeData = () => {},
  deleteEdge = () => {},
  edges = [],
  connectedHandles = new Set(),
  soleSelectedNodeId = null,
  disabled = false,
  expandedOutputs = false,
  nodeTypes = [],
  workflowTrigger,
  onRunNode,
}: WorkflowProviderProps) {
  const workflowContextValue = useMemo(
    () => ({
      updateNodeData,
      updateEdgeData,
      deleteEdge,
      edges,
      connectedHandles,
      soleSelectedNodeId,
      disabled,
      expandedOutputs,
      nodeTypes,
      workflowTrigger,
      onRunNode,
    }),
    [
      updateNodeData,
      updateEdgeData,
      deleteEdge,
      edges,
      connectedHandles,
      soleSelectedNodeId,
      disabled,
      expandedOutputs,
      nodeTypes,
      workflowTrigger,
      onRunNode,
    ]
  );

  return (
    <WorkflowContext.Provider value={workflowContextValue}>
      {children}
    </WorkflowContext.Provider>
  );
}

// Helper functions for common node updates
export const convertValueByType = (
  value: string,
  type: string
): string | number | boolean | undefined => {
  if (type === "number") {
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }

  if (type === "boolean") {
    return value.toLowerCase() === "true";
  }

  return value;
};

export const updateNodeInput = (
  nodeId: string,
  inputId: string,
  value: unknown,
  inputs: readonly WorkflowParameter[],
  updateNodeData?: UpdateNodeFn,
  edges?: ReactFlowEdge<WorkflowEdgeType>[],
  deleteEdge?: DeleteEdgeFn
): readonly WorkflowParameter[] => {
  const updatedInputs = inputs.map((input) =>
    input.id === inputId ? ({ ...input, value } as WorkflowParameter) : input
  );

  // Delete any edges connected to this input when manually setting a value
  if (edges && deleteEdge) {
    const connectedEdges = edges.filter(
      (edge) => edge.target === nodeId && edge.targetHandle === inputId
    );
    connectedEdges.forEach((edge) => deleteEdge(edge.id));
  }

  updateNodeData?.(nodeId, { inputs: updatedInputs });
  return updatedInputs;
};

export const clearNodeInput = (
  nodeId: string,
  inputId: string,
  inputs: readonly WorkflowParameter[],
  updateNodeData?: UpdateNodeFn
): readonly WorkflowParameter[] => {
  const updatedInputs = inputs.map((input) =>
    input.id === inputId
      ? ({ ...input, value: undefined } as WorkflowParameter)
      : input
  );

  updateNodeData?.(nodeId, { inputs: updatedInputs });
  return updatedInputs;
};

export const updateNodeName = (
  nodeId: string,
  name: string,
  updateNodeData?: UpdateNodeFn
): void => {
  updateNodeData?.(nodeId, { name });
};
