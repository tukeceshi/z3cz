import type {
  AiGenerativeNodeType,
  Edge as BackendEdge,
  Node as BackendNode,
  ObjectReference,
  Parameter,
  WorkflowEditorViewport,
  WorkflowGenerativeDefaults,
  WorkflowRuntime,
  WorkflowTrigger,
} from "@dafthunk/types";
import { buildCatalogAllowedNodeTypeSet } from "@dafthunk/types";
import type {
  Connection,
  Edge as ReactFlowEdge,
  ReactFlowInstance,
  Node as ReactFlowNode,
} from "@xyflow/react";
import { ReactFlowProvider, getConnectedEdges } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { useGenerativeMediaBeforeUnloadGuard } from "@/hooks/use-generative-media-before-unload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { executeWorkflowNode } from "@/services/workflow-service";
import { cn } from "@/utils/utils";

import { HttpRequestConfigDialog } from "./http-request-config-dialog";
import { DeleteSelectionConfirmDialog } from "./delete-selection-confirm-dialog";
import { UpgradeRequiredDialog } from "./upgrade-required-dialog";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import { useResizableSidebar } from "./use-resizable-sidebar";
import { useWorkflowExecutionState } from "./use-workflow-execution-state";
import { useWorkflowState } from "./use-workflow-state";
import { useWorkflowMediaReconcile } from "./use-workflow-media-reconcile";
import { InlineAiTextMigrationHost } from "./inline-ai-text-migration-host";
import { resolveWorkflowNodeDimensions } from "./workflow-node-placement";
import { WorkflowCanvas } from "./workflow-canvas";
import { CloudStorageCanvasProvider } from "./cloud-storage-canvas-provider";
import {
  CreativeStudioProvider,
  useCreativeStudio,
} from "./creative-studio-context";
import { CreativeStudioView } from "./creative-studio-view";
import { WorkflowProvider } from "./workflow-context";
import { WorkflowRunConfigDialog } from "./workflow-run-config-dialog";
import { WorkflowEditorBreadcrumbEffect } from "./workflow-editor-breadcrumb-effect";
import { WorkflowSettingsDialog } from "./workflow-settings-dialog";
import { WorkflowSidebar } from "./workflow-sidebar";
import {
  readAgentSidebarPersistedState,
  writeAgentSidebarPersistedState,
} from "./workflow-agent-sidebar-persisted-state";
import {
  isValidWorkflowEditorViewport,
  restoreEditorViewportWhenPaneStable,
  viewportNearlyEqual,
} from "./workflow-viewport-utils";
import type {
  NodeType,
  WorkflowEdgeType,
  WorkflowExecution,
  WorkflowNodeType,
} from "./workflow-types";


/** Serialize a React Flow node into the backend Node shape (unsaved editor values). */
function serializeNodeSnapshot(
  node: ReactFlowNode<WorkflowNodeType>,
  edges: ReactFlowEdge<WorkflowEdgeType>[]
): BackendNode {
  const incomingEdges = edges.filter((edge) => edge.target === node.id);
  return {
    id: node.id,
    name: node.data.name,
    type: node.data.nodeType || "default",
    position: node.position,
    icon: node.data.icon,
    functionCalling: node.data.functionCalling,
    ...(node.data.metadata ? { metadata: { ...node.data.metadata } } : {}),
    inputs: node.data.inputs.map((input) => {
      const isConnected = incomingEdges.some(
        (edge) => edge.targetHandle === input.id
      );
      const { id: _id, value: inputValue, ...rest } = input;
      const parameter = {
        ...rest,
        name: input.id,
        description: input.name,
      } as Parameter & { value?: unknown };
      if (!isConnected && typeof inputValue !== "undefined") {
        parameter.value = inputValue;
      }
      return parameter as Parameter;
    }),
    outputs: node.data.outputs.map((output) => {
      const { id: _id, value: _value, ...rest } = output;
      return {
        ...rest,
        name: output.id,
        description: output.name,
      } as Parameter;
    }),
  };
}

function collectUpstreamNodeIds(
  targetNodeId: string,
  edges: ReactFlowEdge<WorkflowEdgeType>[]
): Set<string> {
  const upstream = new Set<string>();
  const queue = [targetNodeId];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;

    for (const edge of edges) {
      if (edge.target !== current) continue;
      if (upstream.has(edge.source)) continue;
      upstream.add(edge.source);
      queue.push(edge.source);
    }
  }

  return upstream;
}

function serializeSubgraphForExecute(
  targetNodeId: string,
  nodes: ReactFlowNode<WorkflowNodeType>[],
  edges: ReactFlowEdge<WorkflowEdgeType>[]
): { nodes: BackendNode[]; edges: BackendEdge[] } {
  const upstream = collectUpstreamNodeIds(targetNodeId, edges);
  const includedIds = new Set([targetNodeId, ...upstream]);
  const includedNodes = nodes.filter((node) => includedIds.has(node.id));
  const includedEdges = edges.filter(
    (edge) => includedIds.has(edge.source) && includedIds.has(edge.target)
  );

  return {
    nodes: includedNodes.map((node) => serializeNodeSnapshot(node, edges)),
    edges: includedEdges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceOutput: edge.sourceHandle ?? "",
      targetInput: edge.targetHandle ?? "",
    })),
  };
}

/**
 * Controls the builder's interaction level:
 * - "edit"     — Full editing: drag, connect, add/remove nodes, sidebar, controls
 * - "readonly" — Can zoom/pan/inspect, but cannot modify the workflow
 * - "preview"  — Completely static: no interaction, no sidebar, no controls
 */
type WorkflowBuilderMode = "edit" | "readonly" | "preview";

export interface WorkflowBuilderProps {
  workflowId: string;
  workflowTrigger?: WorkflowTrigger;
  workflowRuntime?: WorkflowRuntime;
  initialNodes?: ReactFlowNode<WorkflowNodeType>[];
  initialEdges?: ReactFlowEdge<WorkflowEdgeType>[];
  nodeTypes?: NodeType[];
  onNodesChange?: (nodes: ReactFlowNode<WorkflowNodeType>[]) => void;
  onEdgesChange?: (edges: ReactFlowEdge<WorkflowEdgeType>[]) => void;
  validateConnection?: (connection: Connection) => boolean;
  executeWorkflow?: (
    workflowId: string,
    onExecution: (execution: WorkflowExecution) => void,
    triggerData?: unknown
  ) => void | (() => void | Promise<void>);
  initialWorkflowExecution?: WorkflowExecution;
  mode?: WorkflowBuilderMode;
  createObjectUrl: (objectReference: ObjectReference) => string;
  expandedOutputs?: boolean;
  workflowName?: string;
  workflowDescription?: string;
  onWorkflowUpdate?: (name: string, description?: string) => void;
  onPersistRuntime?: (runtime: WorkflowRuntime) => void;
  orgId: string;
  wsExecuteWorkflow?: (options?: {
    parameters?: Record<string, unknown>;
  }) => void;
  showSidebar?: boolean;
  showBackground?: boolean;
  fitViewPadding?: number;
  /** After workflow creation: center canvas at 100% zoom on first editor open only. */
  initialViewportOneToOne?: boolean;
  savedEditorViewport?: WorkflowEditorViewport | null;
  /** Bumps when a remote tab or reconnect pushes a new saved viewport. */
  editorViewportSyncRevision?: number;
  onEditorViewportChange?: (viewport: WorkflowEditorViewport) => void;
  onEditorViewportGestureEnd?: (viewport: WorkflowEditorViewport) => void;
  onCommitEditorViewport?: (viewport: WorkflowEditorViewport) => void;
  generativeDefaults?: WorkflowGenerativeDefaults;
  onGenerativeDefaultsChange?: (
    defaults: WorkflowGenerativeDefaults
  ) => void;
  /** True after HTTP has loaded the workflow graph (Persist-First). */
  graphReady?: boolean;
  workflowSettingsOpen?: boolean;
  onWorkflowSettingsOpenChange?: (open: boolean) => void;
  workflowsListUrl?: string;
  onOpenWorkflowSettings?: () => void;
}

export function WorkflowBuilder({
  workflowId,
  workflowTrigger,
  workflowRuntime,
  initialNodes = [],
  initialEdges = [],
  nodeTypes = [],
  onNodesChange: onNodesChangeFromParent,
  onEdgesChange: onEdgesChangeFromParent,
  validateConnection,
  executeWorkflow,
  initialWorkflowExecution,
  mode = "edit",
  createObjectUrl,
  expandedOutputs = false,
  workflowName,
  workflowDescription,
  onWorkflowUpdate,
  onPersistRuntime,
  orgId,
  wsExecuteWorkflow,
  showSidebar,
  showBackground = true,
  fitViewPadding = 0.25,
  initialViewportOneToOne = false,
  savedEditorViewport,
  editorViewportSyncRevision = 0,
  onEditorViewportChange,
  onEditorViewportGestureEnd,
  onCommitEditorViewport,
  generativeDefaults,
  onGenerativeDefaultsChange,
  graphReady = false,
  workflowSettingsOpen = false,
  onWorkflowSettingsOpenChange,
  workflowsListUrl,
  onOpenWorkflowSettings,
}: WorkflowBuilderProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const readOnly = mode !== "edit";
  const interactive = mode !== "preview";
  const sidebarEnabled = showSidebar ?? interactive;

  const allowedNodeTypes = useMemo(
    () => buildCatalogAllowedNodeTypeSet(nodeTypes),
    [nodeTypes]
  );

  const suppressViewportPersistEndRef = useRef(false);

  // Graph state & operations
  const {
    nodes,
    edges,
    setNodes,
    selectedNodes,
    selectedEdges,
    soleSelectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onConnectStart,
    onConnectEnd,
    handleNodeSelect,
    updateNodeExecution,
    batchUpdateNodeExecutions,
    setReactFlowInstance,
    reactFlowInstance,
    connectionValidationState,
    isValidConnection,
    updateNodeData,
    updateEdgeData,
    deleteEdge,
    deleteNode,
    deleteSelected,
    deselectAll,
    selectNode,
    duplicateSelected,
    applyLayout,
    copySelected,
    cutSelected,
    pasteFromClipboard,
    hasClipboardData,
    onNodeDragStart,
    onNodeDragStop,
    isDraggingRef,
    addNodeMenu,
    closeAddNodeMenu,
    handlePaneClick,
    handlePaneContextMenu,
    handleAddNodeMenuSelect,
    generativeReferenceCatalogs,
  } = useWorkflowState({
    initialNodes,
    initialEdges,
    onNodesChangePersist: onNodesChangeFromParent,
    onEdgesChangePersist: onEdgesChangeFromParent,
    validateConnection,
    createObjectUrl,
    disabled: readOnly,
    allowedNodeTypes,
    nodeTypes,
    orgId,
    generativeDefaults,
    commitEditorViewport: onCommitEditorViewport,
    suppressViewportPersistEndRef,
  });

  useWorkflowMediaReconcile({
    organizationId: orgId,
    workflowId,
    graphReady,
    nodes,
    setNodes,
  });

  // Execution state
  const execution = useWorkflowExecutionState({
    workflowId,
    workflowRuntime: workflowRuntime ?? "workflow",
    orgId,
    nodes,
    nodeTypes,
    initialWorkflowExecution,
    onPersistRuntime,
    executeWorkflow,
    wsExecuteWorkflow,
    updateNodeExecution,
    batchUpdateNodeExecutions,
    updateNodeData,
    deselectAll,
  });

  const agentSidebarPersisted = useMemo(
    () => readAgentSidebarPersistedState(workflowId),
    [workflowId]
  );
  const handleAgentSidebarPersist = useCallback(
    (state: { visible: boolean; width: number }) => {
      writeAgentSidebarPersistedState(workflowId, state);
    },
    [workflowId]
  );
  const sidebar = useResizableSidebar({
    initialVisible: agentSidebarPersisted?.visible ?? false,
    initialWidth: agentSidebarPersisted?.width,
    onPersist: handleAgentSidebarPersist,
  });

  const handleQuickAddAiNode = useCallback(
    (nodeType: "ai-text" | "ai-image" | "ai-video" | "ai-audio") => {
      const template = nodeTypes.find((item) => item.type === nodeType);
      if (!template) {
        appToast.error("workflow.canvas.nodeTypeUnavailable");
        return;
      }
      handleNodeSelect(template);
    },
    [appToast, handleNodeSelect, nodeTypes]
  );

  const handleAddGenerativeNode = useCallback(
    (
      nodeType: AiGenerativeNodeType,
      options?: {
        readonly prompt?: string;
        readonly precedingText?: string;
      }
    ): string | null => {
      const template = nodeTypes.find((item) => item.type === nodeType);
      if (!template) {
        appToast.error("workflow.canvas.nodeTypeUnavailable");
        return null;
      }
      return handleNodeSelect(template, {
        panIntoView: false,
        prompt: options?.prompt,
        precedingText: options?.precedingText,
      });
    },
    [appToast, handleNodeSelect, nodeTypes]
  );

  // Keyboard shortcuts (Cmd+C/X/V/D, Delete)
  const handleActionButtonClick =
    !readOnly && executeWorkflow
      ? execution.handleActionButtonClick
      : undefined;

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    readonly nodeIds: readonly string[];
    readonly edgeCount: number;
  } | null>(null);

  const requestDeleteSelected = useCallback(() => {
    if (readOnly) return;
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
    setDeleteConfirmTarget(null);
    setDeleteConfirmOpen(true);
  }, [readOnly, selectedEdges.length, selectedNodes.length]);

  const requestDeleteStudioNode = useCallback(
    (nodeId: string) => {
      if (readOnly) return;
      const node = nodes.find((item) => item.id === nodeId);
      if (!node) return;
      const connectedEdges = getConnectedEdges([node], edges);
      setDeleteConfirmTarget({
        nodeIds: [nodeId],
        edgeCount: connectedEdges.length,
      });
      setDeleteConfirmOpen(true);
    },
    [edges, nodes, readOnly]
  );

  const handleDeleteConfirmOpenChange = useCallback((open: boolean) => {
    setDeleteConfirmOpen(open);
    if (!open) {
      setDeleteConfirmTarget(null);
    }
  }, []);

  const handleConfirmDeleteSelected = useCallback(() => {
    if (deleteConfirmTarget && deleteConfirmTarget.nodeIds.length > 0) {
      for (const nodeId of deleteConfirmTarget.nodeIds) {
        deleteNode(nodeId);
      }
    } else {
      deleteSelected();
    }
    setDeleteConfirmTarget(null);
    setDeleteConfirmOpen(false);
  }, [deleteConfirmTarget, deleteNode, deleteSelected]);

  const handleFitToScreen = useCallback(() => {
    reactFlowInstance?.fitView({
      padding: fitViewPadding,
      duration: 200,
      maxZoom: 2,
    });
  }, [reactFlowInstance, fitViewPadding]);

  const [canPersistViewport, setCanPersistViewport] = useState(false);
  const [isViewportMoving, setIsViewportMoving] = useState(false);
  const appliedViewportKeyRef = useRef<string | null>(null);
  const pendingRemoteViewportRef = useRef<WorkflowEditorViewport | null>(null);
  const cancelViewportRestoreRef = useRef<(() => void) | null>(null);
  const noSavedViewportPersistTimerRef = useRef<number | null>(null);

  const mountDefaultViewport = useMemo(() => {
    if (initialViewportOneToOne) {
      return undefined;
    }
    if (
      savedEditorViewport != null &&
      isValidWorkflowEditorViewport(savedEditorViewport)
    ) {
      return savedEditorViewport;
    }
    return undefined;
  }, [initialViewportOneToOne, savedEditorViewport]);

  const hasSavedViewport = mountDefaultViewport != null;
  const skipInitialFitView = initialViewportOneToOne || hasSavedViewport;

  const [canvasRevealed, setCanvasRevealed] = useState(
    () => !hasSavedViewport && !initialViewportOneToOne
  );

  const enableViewportPersistence = useCallback(() => {
    setCanPersistViewport(true);
  }, []);

  const handleReactFlowInit = useCallback(
    (
      instance: ReactFlowInstance<
        ReactFlowNode<WorkflowNodeType>,
        ReactFlowEdge<WorkflowEdgeType>
      >
    ) => {
      setReactFlowInstance(instance);

      if (initialViewportOneToOne) {
        suppressViewportPersistEndRef.current = true;
        const flowNodes = instance.getNodes();
        if (flowNodes.length === 0) {
          void instance.setViewport({ x: 0, y: 0, zoom: 1 });
        } else {
          void instance.fitView({
            padding: fitViewPadding,
            minZoom: 1,
            maxZoom: 1,
            duration: 0,
          });
        }
        setCanvasRevealed(true);
        window.setTimeout(() => {
          enableViewportPersistence();
        }, 600);
        return;
      }

      if (mountDefaultViewport) {
        suppressViewportPersistEndRef.current = true;
        cancelViewportRestoreRef.current?.();
        cancelViewportRestoreRef.current = restoreEditorViewportWhenPaneStable(
          instance,
          mountDefaultViewport,
          () => {
            appliedViewportKeyRef.current = JSON.stringify(mountDefaultViewport);
            cancelViewportRestoreRef.current = null;
            setCanvasRevealed(true);
            requestAnimationFrame(() => {
              enableViewportPersistence();
            });
          }
        );
        return;
      }

      setCanvasRevealed(true);
      if (noSavedViewportPersistTimerRef.current === null) {
        noSavedViewportPersistTimerRef.current = window.setTimeout(() => {
          noSavedViewportPersistTimerRef.current = null;
          enableViewportPersistence();
        }, 600);
      }
    },
    [
      setReactFlowInstance,
      initialViewportOneToOne,
      fitViewPadding,
      mountDefaultViewport,
      enableViewportPersistence,
    ]
  );

  const restoreSavedEditorViewport = useCallback(
    (
      instance: ReactFlowInstance<
        ReactFlowNode<WorkflowNodeType>,
        ReactFlowEdge<WorkflowEdgeType>
      >,
      viewport: WorkflowEditorViewport
    ) => {
      const viewportKey = JSON.stringify(viewport);
      if (appliedViewportKeyRef.current === viewportKey) {
        return;
      }

      const live = instance.getViewport();
      if (viewportNearlyEqual(live, viewport)) {
        appliedViewportKeyRef.current = viewportKey;
        return;
      }

      cancelViewportRestoreRef.current?.();
      suppressViewportPersistEndRef.current = true;
      cancelViewportRestoreRef.current = restoreEditorViewportWhenPaneStable(
        instance,
        viewport,
        () => {
          appliedViewportKeyRef.current = viewportKey;
          cancelViewportRestoreRef.current = null;
          setCanvasRevealed(true);
          requestAnimationFrame(() => {
            enableViewportPersistence();
          });
        }
      );
    },
    [enableViewportPersistence]
  );

  useEffect(() => {
    if (
      initialViewportOneToOne ||
      !reactFlowInstance ||
      !savedEditorViewport ||
      !isValidWorkflowEditorViewport(savedEditorViewport) ||
      editorViewportSyncRevision === 0
    ) {
      return;
    }

    if (isViewportMoving) {
      pendingRemoteViewportRef.current = savedEditorViewport;
      return;
    }

    restoreSavedEditorViewport(reactFlowInstance, savedEditorViewport);
  }, [
    editorViewportSyncRevision,
    savedEditorViewport,
    initialViewportOneToOne,
    reactFlowInstance,
    isViewportMoving,
    restoreSavedEditorViewport,
  ]);

  useEffect(() => {
    if (isViewportMoving || !reactFlowInstance) {
      return;
    }

    const pending = pendingRemoteViewportRef.current;
    if (!pending) {
      return;
    }

    pendingRemoteViewportRef.current = null;
    restoreSavedEditorViewport(reactFlowInstance, pending);
  }, [isViewportMoving, reactFlowInstance, restoreSavedEditorViewport]);

  useEffect(() => {
    appliedViewportKeyRef.current = null;
    pendingRemoteViewportRef.current = null;
    setCanPersistViewport(false);
    setCanvasRevealed(!hasSavedViewport && !initialViewportOneToOne);
    if (noSavedViewportPersistTimerRef.current !== null) {
      window.clearTimeout(noSavedViewportPersistTimerRef.current);
      noSavedViewportPersistTimerRef.current = null;
    }
  }, [workflowId, hasSavedViewport, initialViewportOneToOne]);

  useEffect(() => {
    return () => {
      cancelViewportRestoreRef.current?.();
      if (noSavedViewportPersistTimerRef.current !== null) {
        window.clearTimeout(noSavedViewportPersistTimerRef.current);
      }
    };
  }, []);

  const handleZoomOneToOne = useCallback(() => {
    reactFlowInstance?.zoomTo(1, { duration: 200 });
  }, [reactFlowInstance]);

  const viewportMoveEndTimerRef = useRef<number | null>(null);

  const handleViewportMoveStart = useCallback(() => {
    if (viewportMoveEndTimerRef.current !== null) {
      window.clearTimeout(viewportMoveEndTimerRef.current);
      viewportMoveEndTimerRef.current = null;
    }
    setIsViewportMoving(true);
  }, []);
  const handleViewportMoveEnd = useCallback(() => {
    if (viewportMoveEndTimerRef.current !== null) {
      window.clearTimeout(viewportMoveEndTimerRef.current);
    }
    viewportMoveEndTimerRef.current = window.setTimeout(() => {
      viewportMoveEndTimerRef.current = null;
      setIsViewportMoving(false);
    }, 150);
  }, []);

  // Single-node run: send unsaved editor snapshot, write results back to canvas.
  const handleRunNode = useCallback(
    async (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) {
        appToast.error("errors.nodeNotFound");
        return;
      }

      updateNodeExecution(nodeId, {
        state: "executing",
        outputs: {},
        error: undefined,
      });

      try {
        const snapshot = serializeSubgraphForExecute(nodeId, nodes, edges);
        const response = await executeWorkflowNode(
          workflowId,
          nodeId,
          orgId,
          snapshot.nodes.find((entry) => entry.id === nodeId),
          snapshot
        );
        const nodeExecution = response.nodeExecutions?.find(
          (ne) => ne.nodeId === nodeId
        );
        if (nodeExecution) {
          updateNodeExecution(nodeId, {
            state: nodeExecution.status,
            outputs: nodeExecution.outputs || {},
            error: nodeExecution.error,
          });
        } else {
          updateNodeExecution(nodeId, {
            state: response.status === "completed" ? "completed" : "error",
            error:
              response.status === "completed"
                ? undefined
                : t("errors.noExecutionResult"),
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("errors.runNodeFailed");
        updateNodeExecution(nodeId, {
          state: "error",
          error: message,
        });
        appToast.errorRaw(message);
      }
    },
    [nodes, edges, workflowId, orgId, updateNodeExecution, appToast, t]
  );

  const handleReturnToCanvas = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) return;
      selectNode(nodeId);
    },
    [selectNode]
  );

  const handleReturnToCanvasFromDetail = useCallback(
    (nodeId: string | null) => {
      if (!nodeId || !reactFlowInstance) return;

      selectNode(nodeId);
      suppressViewportPersistEndRef.current = true;

      const node = reactFlowInstance.getNode(nodeId);
      if (!node) return;

      const { width, height } = resolveWorkflowNodeDimensions(
        node.data.nodeType,
        node
      );
      const { zoom } = reactFlowInstance.getViewport();
      void reactFlowInstance.setCenter(
        node.position.x + width / 2,
        node.position.y + height / 2,
        { zoom, duration: 300 }
      );
    },
    [reactFlowInstance, selectNode]
  );

  return (
    <ReactFlowProvider>
      <WorkflowProvider
        updateNodeData={readOnly ? undefined : updateNodeData}
        updateEdgeData={readOnly ? undefined : updateEdgeData}
        deleteEdge={readOnly ? undefined : deleteEdge}
        edges={edges}
        soleSelectedNodeId={soleSelectedNodeId}
        isViewportMoving={isViewportMoving}
        disabled={readOnly}
        expandedOutputs={expandedOutputs}
        nodeTypes={nodeTypes}
        allowedNodeTypes={allowedNodeTypes}
        workflowTrigger={workflowTrigger}
        onRunNode={readOnly ? undefined : handleRunNode}
        generativeDefaults={generativeDefaults}
        onGenerativeDefaultChange={onGenerativeDefaultsChange}
        generativeReferenceCatalogs={generativeReferenceCatalogs}
      >
        <CreativeStudioProvider
          workflowId={workflowId}
          onReturnToCanvas={handleReturnToCanvas}
          onReturnToCanvasFromDetail={handleReturnToCanvasFromDetail}
          onAddGenerativeNode={
            readOnly ? undefined : handleAddGenerativeNode
          }
          onRequestDeleteStudioNode={
            readOnly ? undefined : requestDeleteStudioNode
          }
        >
          <WorkflowStudioKeyboardShortcuts
            readOnly={readOnly}
            selectedNodes={selectedNodes}
            selectedEdges={selectedEdges}
            hasClipboardData={hasClipboardData}
            copySelected={copySelected}
            cutSelected={cutSelected}
            pasteFromClipboard={pasteFromClipboard}
            duplicateSelected={duplicateSelected}
            requestDeleteSelected={requestDeleteSelected}
            requestDeleteStudioNode={requestDeleteStudioNode}
          />
          <CreativeStudioCanvasSync selectNode={selectNode} />
          {workflowsListUrl ? (
            <WorkflowEditorBreadcrumbEffect
              workflowName={workflowName ?? ""}
              workflowsListUrl={workflowsListUrl}
              readOnly={readOnly}
              onOpenWorkflowSettings={onOpenWorkflowSettings}
              soleSelectedNodeId={soleSelectedNodeId}
            />
          ) : null}
          <div className="w-full h-full min-h-0 flex flex-col">
          <CloudStorageCanvasProvider orgId={orgId} enabled={!readOnly}>
            <InlineAiTextMigrationHost
              organizationId={orgId}
              workflowId={workflowId}
              graphReady={graphReady}
              nodes={nodes}
              setNodes={setNodes}
            />
            <div className="flex min-h-0 flex-1">
              <div
                className={cn(
                  "h-full overflow-hidden relative",
                  !canvasRevealed && "invisible"
                )}
                style={{
                  width: sidebar.isSidebarVisible
                    ? `calc(100% - ${sidebar.sidebarWidth}px)`
                    : "100%",
                }}
              >
                <WorkflowEditorMainArea
                  nodes={nodes}
                  edges={edges}
                  connectionValidationState={connectionValidationState}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onConnectStart={onConnectStart}
                  onConnectEnd={onConnectEnd}
                  onNodeDragStart={onNodeDragStart}
                  onNodeDragStop={onNodeDragStop}
                  isDraggingRef={isDraggingRef}
                  onMoveStart={handleViewportMoveStart}
                  onMoveEnd={handleViewportMoveEnd}
                  onInit={handleReactFlowInit}
                  onQuickAddAiNode={readOnly ? undefined : handleQuickAddAiNode}
                  onAction={handleActionButtonClick}
                  workflowStatus={execution.workflowStatus}
                  workflowErrorMessage={execution.workflowErrorMessage}
                  onToggleSidebar={
                    sidebarEnabled ? sidebar.toggleSidebar : undefined
                  }
                  isSidebarVisible={
                    sidebarEnabled ? sidebar.isSidebarVisible : false
                  }
                  isValidConnection={isValidConnection}
                  disabled={readOnly}
                  onFitToScreen={handleFitToScreen}
                  onZoomOneToOne={handleZoomOneToOne}
                  selectedNodes={selectedNodes}
                  selectedEdges={selectedEdges}
                  onDeleteSelected={readOnly ? undefined : requestDeleteSelected}
                  onDuplicateSelected={readOnly ? undefined : duplicateSelected}
                  onApplyLayout={readOnly ? undefined : applyLayout}
                  onCopySelected={readOnly ? undefined : copySelected}
                  onCutSelected={readOnly ? undefined : cutSelected}
                  onPasteFromClipboard={
                    readOnly ? undefined : pasteFromClipboard
                  }
                  hasClipboardData={hasClipboardData}
                  showControls={interactive}
                  showBackground={showBackground}
                  fitViewPadding={fitViewPadding}
                  skipInitialFitView={skipInitialFitView}
                  defaultViewport={mountDefaultViewport}
                  onEditorViewportChange={
                    readOnly || !canPersistViewport
                      ? undefined
                      : onEditorViewportChange
                  }
                  onEditorViewportGestureEnd={
                    readOnly || !canPersistViewport
                      ? undefined
                      : onEditorViewportGestureEnd
                  }
                  suppressViewportPersistEndRef={suppressViewportPersistEndRef}
                  soleSelectedNodeId={soleSelectedNodeId}
                  isViewportMoving={isViewportMoving}
                  addNodeMenu={addNodeMenu}
                  onAddNodeMenuSelect={
                    readOnly ? undefined : handleAddNodeMenuSelect
                  }
                  onCloseAddNodeMenu={readOnly ? undefined : closeAddNodeMenu}
                  onPaneClick={readOnly ? undefined : handlePaneClick}
                  onPaneContextMenu={
                    readOnly ? undefined : handlePaneContextMenu
                  }
                />
              </div>

              {sidebar.isSidebarVisible && (
                <>
                  <div
                    className={cn(
                      "w-1 bg-neutral-50 border-l border-border cursor-col-resize",
                      sidebar.isResizing && "bg-muted"
                    )}
                    onMouseDown={sidebar.handleResizeStart}
                  />
                  <div style={{ width: `${sidebar.sidebarWidth}px` }}>
                    <WorkflowSidebar
                      selectedNodes={selectedNodes}
                      selectedEdges={selectedEdges}
                      onEdgeUpdate={readOnly ? undefined : updateEdgeData}
                      disabledWorkflow={readOnly}
                    />
                  </div>
                </>
              )}
            </div>
          </CloudStorageCanvasProvider>

          <WorkflowSettingsDialog
            open={workflowSettingsOpen}
            onOpenChange={onWorkflowSettingsOpenChange ?? (() => {})}
            workflowName={workflowName}
            workflowDescription={workflowDescription}
            onWorkflowUpdate={readOnly ? undefined : onWorkflowUpdate}
            disabledWorkflow={readOnly}
            workflowStatus={execution.workflowStatus}
            workflowErrorMessage={execution.workflowErrorMessage}
          />
        </div>

        <DeleteSelectionConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={handleDeleteConfirmOpenChange}
          nodeCount={
            deleteConfirmTarget?.nodeIds.length ?? selectedNodes.length
          }
          edgeCount={deleteConfirmTarget?.edgeCount ?? selectedEdges.length}
          onConfirm={handleConfirmDeleteSelected}
        />

        <WorkflowRunConfigDialog
          open={execution.isRunConfigDialogVisible}
          onOpenChange={execution.setRunConfigDialogVisible}
          initialRuntime={workflowRuntime ?? "workflow"}
          onConfirm={execution.confirmRunConfig}
        />

        <HttpRequestConfigDialog
          isOpen={execution.isHttpRequestConfigDialogVisible}
          onClose={execution.closeExecutionForm}
          onSubmit={execution.submitHttpRequestConfig}
        />

        <Dialog
          open={execution.errorDialogOpen}
          onOpenChange={execution.setErrorDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("workflow.execution.errorTitle")}</DialogTitle>
              <DialogDescription>
                {t("workflow.execution.errorDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => execution.setErrorDialogOpen(false)}>
                {t("workflow.execution.close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <UpgradeRequiredDialog
          open={execution.upgradeDialogOpen}
          onOpenChange={execution.setUpgradeDialogOpen}
          gatedNodeTypes={execution.upgradeDialogGatedNodeTypes}
          variant={execution.upgradeDialogVariant}
        />
        </CreativeStudioProvider>
      </WorkflowProvider>
    </ReactFlowProvider>
  );
}

function WorkflowStudioKeyboardShortcuts({
  readOnly,
  selectedNodes,
  selectedEdges,
  hasClipboardData,
  copySelected,
  cutSelected,
  pasteFromClipboard,
  duplicateSelected,
  requestDeleteSelected,
  requestDeleteStudioNode,
}: {
  readonly readOnly: boolean;
  readonly selectedNodes: ReactFlowNode<WorkflowNodeType>[];
  readonly selectedEdges: ReactFlowEdge<WorkflowEdgeType>[];
  readonly hasClipboardData: boolean;
  readonly copySelected: () => void;
  readonly cutSelected: () => void;
  readonly pasteFromClipboard: () => void;
  readonly duplicateSelected: () => void;
  readonly requestDeleteSelected: () => void;
  readonly requestDeleteStudioNode: (nodeId: string) => void;
}) {
  const { viewMode, studioNodeId } = useCreativeStudio();

  const requestDeleteActive = useCallback(() => {
    if (viewMode === "studio" && studioNodeId) {
      requestDeleteStudioNode(studioNodeId);
      return;
    }
    requestDeleteSelected();
  }, [
    requestDeleteSelected,
    requestDeleteStudioNode,
    studioNodeId,
    viewMode,
  ]);

  const hasStudioNodeSelected =
    viewMode === "studio" && studioNodeId != null;

  useKeyboardShortcuts({
    disabled: readOnly,
    clipboardDisabled: readOnly,
    selectedNodes,
    selectedEdges,
    hasClipboardData,
    copySelected,
    cutSelected,
    pasteFromClipboard,
    duplicateSelected,
    requestDeleteSelected: requestDeleteActive,
    hasStudioNodeSelected,
  });

  return null;
}

function CreativeStudioCanvasSync({
  selectNode,
}: {
  readonly selectNode: (nodeId: string) => void;
}) {
  const { viewMode, studioNodeId } = useCreativeStudio();

  useEffect(() => {
    if (viewMode !== "studio" || !studioNodeId) return;
    selectNode(studioNodeId);
  }, [selectNode, studioNodeId, viewMode]);

  return null;
}

type WorkflowEditorMainAreaProps = ComponentProps<typeof WorkflowCanvas>;

function WorkflowEditorMainArea(props: WorkflowEditorMainAreaProps) {
  useGenerativeMediaBeforeUnloadGuard();
  const { viewMode } = useCreativeStudio();

  const isStudio = viewMode === "studio";

  return (
    <div className="relative h-full w-full min-h-0">
      <WorkflowCanvas
        {...props}
        disabled={Boolean(props.disabled) || isStudio}
        showControls={isStudio ? false : props.showControls}
      />

      {isStudio ? (
        <div className="absolute inset-0 z-50">
          <CreativeStudioView />
        </div>
      ) : null}
    </div>
  );
}
