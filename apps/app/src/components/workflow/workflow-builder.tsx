import type {
  Edge as BackendEdge,
  Node as BackendNode,
  ObjectReference,
  Parameter,
  WorkflowBillingMode,
  WorkflowEditorViewport,
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
import { ReactFlowProvider } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

import { ExecutionEmailDialog } from "./execution-email-dialog";
import { HttpRequestConfigDialog } from "./http-request-config-dialog";
import { UpgradeRequiredDialog } from "./upgrade-required-dialog";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import { useResizableSidebar } from "./use-resizable-sidebar";
import { useWorkflowExecutionState } from "./use-workflow-execution-state";
import { useWorkflowState } from "./use-workflow-state";
import { WorkflowCanvas } from "./workflow-canvas";
import { WorkflowProvider } from "./workflow-context";
import { WorkflowNodeSelector } from "./workflow-node-selector";
import { WorkflowSettingsDialog } from "./workflow-settings-dialog";
import { WorkflowSidebar } from "./workflow-sidebar";
import { isValidWorkflowEditorViewport } from "./workflow-viewport-utils";
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
  workflowBillingMode?: WorkflowBillingMode;
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
  disabledFeedback?: boolean;
  createObjectUrl: (objectReference: ObjectReference) => string;
  expandedOutputs?: boolean;
  workflowName?: string;
  workflowDescription?: string;
  onWorkflowUpdate?: (
    name: string,
    description?: string,
    trigger?: WorkflowTrigger,
    runtime?: WorkflowRuntime,
    billingMode?: WorkflowBillingMode
  ) => void;
  orgId: string;
  wsExecuteWorkflow?: (options?: {
    parameters?: Record<string, unknown>;
  }) => void;
  showSidebar?: boolean;
  showBackground?: boolean;
  isEnabled?: boolean;
  isTogglingEnabled?: boolean;
  onToggleEnabled?: (checked: boolean) => void;
  fitViewPadding?: number;
  /** After workflow creation: center canvas at 100% zoom on first editor open only. */
  initialViewportOneToOne?: boolean;
  savedEditorViewport?: WorkflowEditorViewport | null;
  onEditorViewportChange?: (viewport: WorkflowEditorViewport) => void;
  workflowSettingsOpen?: boolean;
  onWorkflowSettingsOpenChange?: (open: boolean) => void;
}

export function WorkflowBuilder({
  workflowId,
  workflowTrigger,
  workflowRuntime,
  workflowBillingMode = "platform",
  initialNodes = [],
  initialEdges = [],
  nodeTypes = [],
  onNodesChange: onNodesChangeFromParent,
  onEdgesChange: onEdgesChangeFromParent,
  validateConnection,
  executeWorkflow,
  initialWorkflowExecution,
  mode = "edit",
  disabledFeedback = false,
  createObjectUrl,
  expandedOutputs = false,
  workflowName,
  workflowDescription,
  onWorkflowUpdate,
  orgId,
  wsExecuteWorkflow,
  showSidebar,
  showBackground = true,
  isEnabled,
  isTogglingEnabled,
  onToggleEnabled,
  fitViewPadding = 0.25,
  initialViewportOneToOne = false,
  savedEditorViewport,
  onEditorViewportChange,
  workflowSettingsOpen = false,
  onWorkflowSettingsOpenChange,
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

  // Graph state & operations
  const {
    nodes,
    edges,
    selectedNodes,
    selectedEdges,
    soleSelectedNodeId,
    isNodeSelectorOpen,
    setIsNodeSelectorOpen,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onConnectStart,
    onConnectEnd,
    handleAddNode,
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
    deleteSelected,
    deselectAll,
    duplicateSelected,
    applyLayout,
    copySelected,
    cutSelected,
    pasteFromClipboard,
    hasClipboardData,
    onNodeDragStart,
    onNodeDragStop,
    isDraggingRef,
    addTriggerNodes,
    removeTriggerNodes,
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
  });

  // Execution state
  const execution = useWorkflowExecutionState({
    workflowId,
    workflowTrigger,
    orgId,
    nodes,
    nodeTypes,
    initialWorkflowExecution,
    executeWorkflow,
    wsExecuteWorkflow,
    updateNodeExecution,
    batchUpdateNodeExecutions,
    updateNodeData,
    deselectAll,
  });

  // Sidebar (Agent panel) — collapsed by default; user opens via toggle
  const sidebar = useResizableSidebar({ initialVisible: false });

  const handleQuickAddAiNode = useCallback(
    (nodeType: "ai-text" | "ai-image" | "ai-video") => {
      const template = nodeTypes.find((item) => item.type === nodeType);
      if (!template) {
        appToast.error("workflow.canvas.nodeTypeUnavailable");
        return;
      }
      handleNodeSelect(template);
    },
    [appToast, handleNodeSelect, nodeTypes]
  );

  // Keyboard shortcuts (Cmd+C/X/V/D + Cmd+Enter)
  const handleActionButtonClick =
    !readOnly && executeWorkflow
      ? execution.handleActionButtonClick
      : undefined;

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
    onAction: handleActionButtonClick,
    nodeCount: nodes.length,
  });

  const suppressViewportPersistEndRef = useRef(false);

  const handleFitToScreen = useCallback(() => {
    reactFlowInstance?.fitView({
      padding: fitViewPadding,
      duration: 200,
      maxZoom: 2,
    });
  }, [reactFlowInstance, fitViewPadding]);

  const handleReactFlowInit = useCallback(
    (
      instance: ReactFlowInstance<
        ReactFlowNode<WorkflowNodeType>,
        ReactFlowEdge<WorkflowEdgeType>
      >
    ) => {
      setReactFlowInstance(instance);

      if (!initialViewportOneToOne) {
        return;
      }

      suppressViewportPersistEndRef.current = true;
      const flowNodes = instance.getNodes();
      if (flowNodes.length === 0) {
        void instance.setViewport({ x: 0, y: 0, zoom: 1 });
        return;
      }

      void instance.fitView({
        padding: fitViewPadding,
        minZoom: 1,
        maxZoom: 1,
        duration: 0,
      });
    },
    [setReactFlowInstance, initialViewportOneToOne, fitViewPadding]
  );

  const handleZoomOneToOne = useCallback(() => {
    reactFlowInstance?.zoomTo(1, { duration: 200 });
  }, [reactFlowInstance]);

  const [isViewportMoving, setIsViewportMoving] = useState(false);
  const handleViewportMoveStart = useCallback(() => {
    setIsViewportMoving(true);
  }, []);
  const handleViewportMoveEnd = useCallback(() => {
    setIsViewportMoving(false);
  }, []);

  const restoredDefaultViewport = useMemo(() => {
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

  const skipInitialFitView =
    initialViewportOneToOne || restoredDefaultViewport != null;

  const [canPersistViewport, setCanPersistViewport] = useState(false);

  useEffect(() => {
    if (restoredDefaultViewport) {
      suppressViewportPersistEndRef.current = true;
    }
  }, [restoredDefaultViewport]);

  const appliedViewportKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!reactFlowInstance || initialViewportOneToOne) {
      return;
    }
    if (
      savedEditorViewport == null ||
      !isValidWorkflowEditorViewport(savedEditorViewport)
    ) {
      return;
    }

    const viewportKey = JSON.stringify(savedEditorViewport);
    if (appliedViewportKeyRef.current === viewportKey) {
      return;
    }

    suppressViewportPersistEndRef.current = true;
    void reactFlowInstance.setViewport(savedEditorViewport, { duration: 0 });
    appliedViewportKeyRef.current = viewportKey;
    const readyTimer = window.setTimeout(() => {
      setCanPersistViewport(true);
    }, 0);
    return () => window.clearTimeout(readyTimer);
  }, [reactFlowInstance, savedEditorViewport, initialViewportOneToOne]);

  useEffect(() => {
    if (initialViewportOneToOne) {
      return;
    }
    if (savedEditorViewport != null) {
      return;
    }

    const readyTimer = window.setTimeout(() => {
      setCanPersistViewport(true);
    }, 600);
    return () => window.clearTimeout(readyTimer);
  }, [initialViewportOneToOne, savedEditorViewport]);

  useEffect(() => {
    if (!initialViewportOneToOne) {
      return;
    }
    const readyTimer = window.setTimeout(() => {
      setCanPersistViewport(true);
    }, 600);
    return () => window.clearTimeout(readyTimer);
  }, [initialViewportOneToOne]);

  // Check if workflow already contains a trigger node
  const hasTriggerNode = useMemo(() => {
    if (!nodeTypes) return false;
    const triggerTypes = new Set(
      nodeTypes.filter((t) => t.trigger).map((t) => t.type)
    );
    return nodes.some(
      (n) => n.data.nodeType && triggerTypes.has(n.data.nodeType)
    );
  }, [nodes, nodeTypes]);

  // Trigger change: confirmation dialog + node swap
  const [triggerConfirmOpen, setTriggerConfirmOpen] = useState(false);
  const pendingTriggerRef = useRef<WorkflowTrigger | null>(null);

  const applyTriggerChange = useCallback(
    (newTrigger: WorkflowTrigger) => {
      removeTriggerNodes();
      addTriggerNodes(newTrigger);
      onWorkflowUpdate?.(
        workflowName || "",
        workflowDescription || undefined,
        newTrigger,
        workflowRuntime,
        workflowBillingMode
      );
    },
    [
      removeTriggerNodes,
      addTriggerNodes,
      onWorkflowUpdate,
      workflowName,
      workflowDescription,
      workflowRuntime,
      workflowBillingMode,
    ]
  );

  const handleTriggerChange = useCallback((newTrigger: WorkflowTrigger) => {
    pendingTriggerRef.current = newTrigger;
    setTriggerConfirmOpen(true);
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
      >
        <div className="w-full h-full min-h-0 flex flex-col">
          <div className="flex min-h-0 flex-1">
          <div
            className="h-full overflow-hidden relative"
            style={{
              width: sidebar.isSidebarVisible
                ? `calc(100% - ${sidebar.sidebarWidth}px)`
                : "100%",
            }}
          >
            <WorkflowCanvas
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
              onAddNode={readOnly ? undefined : handleAddNode}
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
              onDeleteSelected={readOnly ? undefined : deleteSelected}
              onDuplicateSelected={readOnly ? undefined : duplicateSelected}
              onApplyLayout={readOnly ? undefined : applyLayout}
              onCopySelected={readOnly ? undefined : copySelected}
              onCutSelected={readOnly ? undefined : cutSelected}
              onPasteFromClipboard={readOnly ? undefined : pasteFromClipboard}
              hasClipboardData={hasClipboardData}
              showControls={interactive}
              showBackground={showBackground}
              fitViewPadding={fitViewPadding}
              skipInitialFitView={skipInitialFitView}
              defaultViewport={restoredDefaultViewport}
              onEditorViewportChange={
                readOnly || !canPersistViewport
                  ? undefined
                  : onEditorViewportChange
              }
              suppressViewportPersistEndRef={suppressViewportPersistEndRef}
              soleSelectedNodeId={soleSelectedNodeId}
              isViewportMoving={isViewportMoving}
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

          <WorkflowNodeSelector
            open={readOnly ? false : isNodeSelectorOpen}
            onSelect={handleNodeSelect}
            onClose={() => setIsNodeSelectorOpen(false)}
            templates={nodeTypes}
            workflowName={workflowName}
            workflowDescription={workflowDescription}
            hasTriggerNode={hasTriggerNode}
          />

          <WorkflowSettingsDialog
            open={workflowSettingsOpen}
            onOpenChange={onWorkflowSettingsOpenChange ?? (() => {})}
            workflowId={workflowId}
            workflowName={workflowName}
            workflowDescription={workflowDescription}
            workflowTrigger={workflowTrigger}
            workflowRuntime={workflowRuntime}
            workflowBillingMode={workflowBillingMode}
            onWorkflowUpdate={readOnly ? undefined : onWorkflowUpdate}
            disabledWorkflow={readOnly}
            disabledFeedback={disabledFeedback}
            workflowStatus={execution.workflowStatus}
            workflowErrorMessage={execution.workflowErrorMessage}
            executionId={execution.currentExecutionId}
            isEnabled={isEnabled}
            isTogglingEnabled={isTogglingEnabled}
            onToggleEnabled={readOnly ? undefined : onToggleEnabled}
            onTriggerChange={readOnly ? undefined : handleTriggerChange}
          />
        </div>
        </div>

        {(workflowTrigger === "http_webhook" ||
          workflowTrigger === "http_request") && (
          <HttpRequestConfigDialog
            isOpen={execution.isHttpRequestConfigDialogVisible}
            onClose={execution.closeExecutionForm}
            onSubmit={execution.submitHttpRequestConfig}
          />
        )}

        {workflowTrigger === "email_message" && (
          <ExecutionEmailDialog
            isOpen={execution.isEmailFormDialogVisible}
            onClose={execution.closeExecutionForm}
            onCancel={() => {
              execution.closeExecutionForm();
              execution.executeRef.current = null;
            }}
            onSubmit={execution.submitEmailFormData}
          />
        )}

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

        <AlertDialog
          open={triggerConfirmOpen}
          onOpenChange={setTriggerConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("workflow.triggerConfirm.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("workflow.triggerConfirm.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  pendingTriggerRef.current = null;
                  setTriggerConfirmOpen(false);
                }}
              >
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingTriggerRef.current) {
                    applyTriggerChange(pendingTriggerRef.current);
                    pendingTriggerRef.current = null;
                  }
                  setTriggerConfirmOpen(false);
                }}
              >
                {t("workflow.triggerConfirm.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </WorkflowProvider>
    </ReactFlowProvider>
  );
}
