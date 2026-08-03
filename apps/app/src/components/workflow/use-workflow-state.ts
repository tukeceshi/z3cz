import type { ObjectReference, WorkflowTrigger } from "@dafthunk/types";
import type {
  Connection,
  IsValidConnection,
  OnConnect,
  OnConnectEnd,
  OnConnectStart,
  OnEdgesChange,
  OnNodesChange,
  Edge as ReactFlowEdge,
  ReactFlowInstance,
  Node as ReactFlowNode,
} from "@xyflow/react";
import type { RefObject } from "react";
import { useMemo } from "react";

import { useClipboard } from "./use-clipboard";
import { useGraphOperations } from "./use-graph-operations";
import { useGraphPersistence } from "./use-graph-persistence";
import { useLayout } from "./use-layout";
import type {
  ConnectionValidationState,
  NodeExecutionUpdate,
  NodeType,
  WorkflowEdgeType,
  WorkflowNodeType,
} from "./workflow-types";

interface UseWorkflowStateProps {
  initialNodes?: ReactFlowNode<WorkflowNodeType>[];
  initialEdges?: ReactFlowEdge<WorkflowEdgeType>[];
  onNodesChangePersist?: (nodes: ReactFlowNode<WorkflowNodeType>[]) => void;
  onEdgesChangePersist?: (edges: ReactFlowEdge<WorkflowEdgeType>[]) => void;
  validateConnection?: (connection: Connection) => boolean;
  createObjectUrl: (objectReference: ObjectReference) => string;
  disabled?: boolean;
  allowedNodeTypes?: ReadonlySet<string>;
  nodeTypes?: NodeType[];
  orgId?: string;
}

interface UseWorkflowStateReturn {
  nodes: ReactFlowNode<WorkflowNodeType>[];
  edges: ReactFlowEdge<WorkflowEdgeType>[];
  selectedNodes: ReactFlowNode<WorkflowNodeType>[];
  selectedEdges: ReactFlowEdge<WorkflowEdgeType>[];
  reactFlowInstance: ReactFlowInstance<
    ReactFlowNode<WorkflowNodeType>,
    ReactFlowEdge<WorkflowEdgeType>
  > | null;
  isNodeSelectorOpen: boolean;
  setIsNodeSelectorOpen: (open: boolean) => void;
  onNodesChange: OnNodesChange<ReactFlowNode<WorkflowNodeType>>;
  onEdgesChange: OnEdgesChange<ReactFlowEdge<WorkflowEdgeType>>;
  onConnect: OnConnect;
  onConnectStart: OnConnectStart;
  onConnectEnd: OnConnectEnd;
  onNodeDragStart: () => void;
  onNodeDragStop: (
    event: React.MouseEvent,
    node: ReactFlowNode<WorkflowNodeType>
  ) => void;
  connectionValidationState: ConnectionValidationState;
  isValidConnection: IsValidConnection<ReactFlowEdge<WorkflowEdgeType>>;
  handleAddNode: () => void;
  handleNodeSelect: (template: NodeType) => void;
  setReactFlowInstance: (
    instance: ReactFlowInstance<
      ReactFlowNode<WorkflowNodeType>,
      ReactFlowEdge<WorkflowEdgeType>
    > | null
  ) => void;
  updateNodeExecution: (nodeId: string, update: NodeExecutionUpdate) => void;
  batchUpdateNodeExecutions: (
    updates: Readonly<Record<string, NodeExecutionUpdate>>
  ) => void;
  updateNodeData: (
    nodeId: string,
    data:
      | Partial<WorkflowNodeType>
      | ((current: WorkflowNodeType) => Partial<WorkflowNodeType>)
  ) => void;
  updateEdgeData: (edgeId: string, data: Partial<WorkflowEdgeType>) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  deleteSelected: () => void;
  deselectAll: () => void;
  selectNode: (nodeId: string) => void;
  addTriggerNodes: (trigger: WorkflowTrigger) => void;
  removeTriggerNodes: () => void;
  duplicateNode: (nodeId: string) => void;
  duplicateSelected: () => void;
  applyLayout: () => void;
  copySelected: () => void;
  cutSelected: () => void;
  pasteFromClipboard: () => void;
  hasClipboardData: boolean;
  soleSelectedNodeId: string | null;
  isDraggingRef: RefObject<boolean>;
}

const NOOP = () => {};

export function useWorkflowState({
  initialNodes = [],
  initialEdges = [],
  onNodesChangePersist,
  onEdgesChangePersist,
  validateConnection,
  createObjectUrl,
  disabled = false,
  allowedNodeTypes,
  nodeTypes = [],
  orgId,
}: UseWorkflowStateProps): UseWorkflowStateReturn {
  // Core graph state and operations
  const graphOps = useGraphOperations({
    initialNodes,
    initialEdges,
    validateConnection,
    createObjectUrl,
    disabled,
    allowedNodeTypes,
    nodeTypes,
    orgId,
  });

  const graphLocked = disabled;
  const clipboardLocked = disabled;

  // Persistence (side-effect only)
  useGraphPersistence({
    nodes: graphOps.nodes,
    edges: graphOps.edges,
    disabled: graphLocked,
    isDraggingRef: graphOps.isDraggingRef,
    onNodesChangePersist,
    onEdgesChangePersist,
  });

  // Layout
  const { applyLayout } = useLayout({
    nodesRef: graphOps.nodesRef,
    edgesRef: graphOps.edgesRef,
    setNodes: graphOps.setNodes,
    reactFlowInstance: graphOps.reactFlowInstance,
    disabled: graphLocked,
  });

  // Clipboard & duplication
  const clipboard = useClipboard({
    nodes: graphOps.nodes,
    edges: graphOps.edges,
    selectedNodes: graphOps.selectedNodes,
    selectedEdges: graphOps.selectedEdges,
    setNodes: graphOps.setNodes,
    setEdges: graphOps.setEdges,
    deleteSelected: graphOps.deleteSelected,
    disabled: graphLocked,
    createObjectUrl,
  });

  return {
    ...graphOps,
    applyLayout,
    duplicateNode: clipboardLocked ? NOOP : clipboard.duplicateNode,
    duplicateSelected: clipboardLocked ? NOOP : clipboard.duplicateSelected,
    copySelected: clipboardLocked ? NOOP : clipboard.copySelected,
    cutSelected: clipboardLocked ? NOOP : clipboard.cutSelected,
    pasteFromClipboard: clipboardLocked ? NOOP : clipboard.pasteFromClipboard,
    hasClipboardData: clipboard.hasClipboardData,
  };
}
