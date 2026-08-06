import type { WorkflowTrigger, WorkflowGenerativeDefaults } from "@dafthunk/types";
import type { Edge as ReactFlowEdge } from "@xyflow/react";
import { createContext, ReactNode, useContext, useMemo } from "react";

import {
  NodeType,
  WorkflowEdgeType,
  WorkflowNodeType,
  WorkflowParameter,
} from "./workflow-types";
import {
  EMPTY_GENERATIVE_REFERENCE_MODEL_CATALOGS,
  type GenerativeReferenceModelCatalogs,
} from "./generative-reference-model-catalogs";

type UpdateNodeFn = (nodeId: string, data: Partial<WorkflowNodeType>) => void;

type UpdateNodeDataFn = (
  nodeId: string,
  data:
    | Partial<WorkflowNodeType>
    | ((current: WorkflowNodeType) => Partial<WorkflowNodeType>)
) => void;
type UpdateEdgeFn = (edgeId: string, data: Partial<WorkflowEdgeType>) => void;
type DeleteEdgeFn = (edgeId: string) => void;
type RunNodeFn = (nodeId: string) => Promise<void>;

/** Stable callbacks and catalog — does not change on selection or edge topology. */
export interface WorkflowActionsContextValue {
  updateNodeData: UpdateNodeDataFn;
  updateEdgeData: UpdateEdgeFn;
  deleteEdge: DeleteEdgeFn;
  disabled: boolean;
  expandedOutputs: boolean;
  nodeTypes: NodeType[];
  allowedNodeTypes: ReadonlySet<string>;
  workflowTrigger?: WorkflowTrigger;
  onRunNode?: RunNodeFn;
  generativeDefaults?: WorkflowGenerativeDefaults;
  onGenerativeDefaultChange?: (defaults: WorkflowGenerativeDefaults) => void;
  generativeReferenceCatalogs: GenerativeReferenceModelCatalogs;
}

/** Volatile graph UI state — changes on selection, edges, viewport gestures. */
export interface WorkflowGraphContextValue {
  edges: ReactFlowEdge<WorkflowEdgeType>[];
  soleSelectedNodeId: string | null;
  isViewportMoving: boolean;
}

export interface WorkflowContextProps
  extends WorkflowActionsContextValue,
    WorkflowGraphContextValue {}

const defaultActions: WorkflowActionsContextValue = {
  updateNodeData: () => {},
  updateEdgeData: () => {},
  deleteEdge: () => {},
  disabled: false,
  expandedOutputs: false,
  nodeTypes: [],
  allowedNodeTypes: new Set(),
  generativeDefaults: undefined,
  onGenerativeDefaultChange: undefined,
  generativeReferenceCatalogs: EMPTY_GENERATIVE_REFERENCE_MODEL_CATALOGS,
};

const defaultGraph: WorkflowGraphContextValue = {
  edges: [],
  soleSelectedNodeId: null,
  isViewportMoving: false,
};

const WorkflowActionsContext =
  createContext<WorkflowActionsContextValue>(defaultActions);
const WorkflowGraphContext =
  createContext<WorkflowGraphContextValue>(defaultGraph);

export function isWorkflowHandleConnected(
  connectedHandles:
    | ReadonlySet<string>
    | readonly string[]
    | undefined,
  nodeId: string,
  handleId: string
): boolean {
  const key = `${nodeId}:${handleId}`;
  if (!connectedHandles) {
    return false;
  }
  if (connectedHandles instanceof Set) {
    return connectedHandles.has(key);
  }
  return connectedHandles.includes(key);
}

export const useWorkflowActions = (): WorkflowActionsContextValue =>
  useContext(WorkflowActionsContext);

export const useWorkflowGraph = (): WorkflowGraphContextValue =>
  useContext(WorkflowGraphContext);

export const useWorkflow = (): WorkflowContextProps => {
  const actions = useWorkflowActions();
  const graph = useWorkflowGraph();
  return useMemo(() => ({ ...actions, ...graph }), [actions, graph]);
};

export interface WorkflowProviderProps {
  readonly children: ReactNode;
  readonly updateNodeData?: UpdateNodeDataFn;
  readonly updateEdgeData?: UpdateEdgeFn;
  readonly deleteEdge?: DeleteEdgeFn;
  readonly edges?: ReactFlowEdge<WorkflowEdgeType>[];
  readonly soleSelectedNodeId?: string | null;
  readonly isViewportMoving?: boolean;
  readonly disabled?: boolean;
  readonly expandedOutputs?: boolean;
  readonly nodeTypes?: NodeType[];
  readonly allowedNodeTypes?: ReadonlySet<string>;
  readonly workflowTrigger?: WorkflowTrigger;
  readonly onRunNode?: RunNodeFn;
  readonly generativeDefaults?: WorkflowGenerativeDefaults;
  readonly onGenerativeDefaultChange?: (
    defaults: WorkflowGenerativeDefaults
  ) => void;
  readonly generativeReferenceCatalogs?: GenerativeReferenceModelCatalogs;
}

export function WorkflowProvider({
  children,
  updateNodeData = () => {},
  updateEdgeData = () => {},
  deleteEdge = () => {},
  edges = [],
  soleSelectedNodeId = null,
  isViewportMoving = false,
  disabled = false,
  expandedOutputs = false,
  nodeTypes = [],
  allowedNodeTypes = new Set(),
  workflowTrigger,
  onRunNode,
  generativeDefaults,
  onGenerativeDefaultChange,
  generativeReferenceCatalogs = EMPTY_GENERATIVE_REFERENCE_MODEL_CATALOGS,
}: WorkflowProviderProps) {
  const actionsValue = useMemo(
    () => ({
      updateNodeData,
      updateEdgeData,
      deleteEdge,
      disabled,
      expandedOutputs,
      nodeTypes,
      allowedNodeTypes,
      workflowTrigger,
      onRunNode,
      generativeDefaults,
      onGenerativeDefaultChange,
      generativeReferenceCatalogs,
    }),
    [
      updateNodeData,
      updateEdgeData,
      deleteEdge,
      disabled,
      expandedOutputs,
      nodeTypes,
      allowedNodeTypes,
      workflowTrigger,
      onRunNode,
      generativeDefaults,
      onGenerativeDefaultChange,
      generativeReferenceCatalogs,
    ]
  );

  const graphValue = useMemo(
    () => ({
      edges,
      soleSelectedNodeId,
      isViewportMoving,
    }),
    [edges, soleSelectedNodeId, isViewportMoving]
  );

  return (
    <WorkflowActionsContext.Provider value={actionsValue}>
      <WorkflowGraphContext.Provider value={graphValue}>
        {children}
      </WorkflowGraphContext.Provider>
    </WorkflowActionsContext.Provider>
  );
}

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

export function upsertNodeInputValue(
  inputs: readonly WorkflowParameter[],
  inputId: string,
  value: unknown,
  type: WorkflowParameter["type"] = "string"
): WorkflowParameter[] {
  if (inputs.some((input) => input.id === inputId)) {
    return inputs.map((input) =>
      input.id === inputId ? ({ ...input, value } as WorkflowParameter) : input
    );
  }

  return [
    ...inputs,
    {
      id: inputId,
      name: inputId,
      type,
      hidden: true,
      value,
    } as WorkflowParameter,
  ];
}

export function upsertNodeInputValues(
  inputs: readonly WorkflowParameter[],
  values: Readonly<Record<string, unknown>>,
  types: Partial<Record<string, WorkflowParameter["type"]>> = {}
): WorkflowParameter[] {
  let next = [...inputs];
  for (const [inputId, value] of Object.entries(values)) {
    next = upsertNodeInputValue(next, inputId, value, types[inputId] ?? "string");
  }
  return next;
}

export const updateNodeInput = (
  nodeId: string,
  inputId: string,
  value: unknown,
  inputs: readonly WorkflowParameter[],
  updateNodeData?: UpdateNodeFn,
  edges?: ReactFlowEdge<WorkflowEdgeType>[],
  deleteEdge?: DeleteEdgeFn
): readonly WorkflowParameter[] => {
  const updatedInputs = upsertNodeInputValue(inputs, inputId, value);

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

export const updateNodeOutput = (
  nodeId: string,
  outputId: string,
  value: unknown,
  outputs: readonly WorkflowParameter[],
  updateNodeData?: UpdateNodeFn
): readonly WorkflowParameter[] => {
  const updatedOutputs = outputs.map((output) =>
    output.id === outputId ? ({ ...output, value } as WorkflowParameter) : output
  );

  updateNodeData?.(nodeId, { outputs: updatedOutputs });
  return updatedOutputs;
};

export const updateNodeName = (
  nodeId: string,
  name: string,
  updateNodeData?: UpdateNodeFn
): void => {
  updateNodeData?.(nodeId, { name });
};
