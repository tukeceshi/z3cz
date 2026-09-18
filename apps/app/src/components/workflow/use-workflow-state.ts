import type {
  ObjectReference,
  WorkflowEditorViewport,
  WorkflowGenerativeDefaults,
} from "@dafthunk/types";
import type {
  Connection,
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "@xyflow/react";
import type { RefObject } from "react";

import type { PendingDetachConfirm } from "./use-graph-history";
import { useClipboard } from "./use-clipboard";
import {
  useGraphOperations,
  type UseGraphOperationsReturn,
} from "./use-graph-operations";
import { useGraphPersistence } from "./use-graph-persistence";
import { useLayout } from "./use-layout";
import type {
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
  generativeDefaults?: WorkflowGenerativeDefaults;
  commitEditorViewport?: (viewport: WorkflowEditorViewport) => void;
  suppressViewportPersistEndRef?: RefObject<boolean>;
  requestDetachConfirm?: (pending: PendingDetachConfirm) => void;
}

interface UseWorkflowStateReturn extends UseGraphOperationsReturn {
  applyLayout: () => void;
  duplicateNode: (nodeId: string) => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  cutSelected: () => void;
  pasteFromClipboard: () => void;
  hasClipboardData: boolean;
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
  generativeDefaults,
  commitEditorViewport,
  suppressViewportPersistEndRef,
  requestDetachConfirm,
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
    generativeDefaults,
    commitEditorViewport,
    suppressViewportPersistEndRef,
    requestDetachConfirm,
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
    onBeforeLayout: graphOps.captureHistory,
  });

  // Clipboard & duplication
  const clipboard = useClipboard({
    nodes: graphOps.nodes,
    edges: graphOps.edges,
    selectedNodes: graphOps.selectedNodes,
    selectedEdges: graphOps.selectedEdges,
    setNodes: graphOps.setNodes,
    setEdges: graphOps.setEdges,
    removeNodesWithoutConfirm: graphOps.removeNodesWithoutConfirm,
    disabled: graphLocked,
    createObjectUrl,
    captureHistory: graphOps.captureHistory,
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
    undo: graphLocked ? NOOP : graphOps.undo,
    redo: graphLocked ? NOOP : graphOps.redo,
    canUndo: graphOps.canUndo,
    canRedo: graphOps.canRedo,
    captureHistory: graphOps.captureHistory,
  };
}
