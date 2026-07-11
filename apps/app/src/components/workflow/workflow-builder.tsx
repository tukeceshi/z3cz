import type {
  Node as BackendNode,
  ObjectReference,
  Parameter,
  WorkflowBillingMode,
  WorkflowRuntime,
  WorkflowTrigger,
} from "@dafthunk/types";
import type {
  Connection,
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "@xyflow/react";
import { ReactFlowProvider } from "@xyflow/react";
import { useCallback, useMemo, useRef, useState } from "react";

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
  workflowSettingsOpen = false,
  onWorkflowSettingsOpenChange,
}: WorkflowBuilderProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const readOnly = mode !== "edit";
  const interactive = mode !== "preview";
  const sidebarEnabled = showSidebar ?? interactive;

  // Graph state & operations
  const {
    nodes,
    edges,
    selectedNodes,
    selectedEdges,
    soleSelectedNodeId,
    connectedHandles,
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
    updateNodeData,
    deselectAll,
  });

  // Sidebar (Agent panel) — collapsed by default; user opens via toggle
  const sidebar = useResizableSidebar({ initialVisible: false });

  const handleQuickAddAiNode = useCallback(
    (nodeType: "ai-text" | "ai-image" | "ai-video") => {
      const template = nodeTypes.find((item) => item.type === nodeType);
      if (template) handleNodeSelect(template);
    },
    [handleNodeSelect, nodeTypes]
  );

  // Keyboard shortcuts (Cmd+C/X/V/D + Cmd+Enter)
  const handleActionButtonClick =
    !readOnly && executeWorkflow
      ? execution.handleActionButtonClick
      : undefined;

  useKeyboardShortcuts({
    disabled: readOnly,
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

  const handleFitToScreen = useCallback(() => {
    reactFlowInstance?.fitView({
      padding: fitViewPadding,
      duration: 200,
      maxZoom: 2,
    });
  }, [reactFlowInstance, fitViewPadding]);

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
        const snapshot = serializeNodeSnapshot(node, edges);
        const response = await executeWorkflowNode(
          workflowId,
          nodeId,
          orgId,
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
        connectedHandles={connectedHandles}
        soleSelectedNodeId={soleSelectedNodeId}
        disabled={readOnly}
        expandedOutputs={expandedOutputs}
        nodeTypes={nodeTypes}
        workflowTrigger={workflowTrigger}
        onRunNode={readOnly ? undefined : handleRunNode}
      >
        <div className="w-full h-full min-h-0 flex">
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
              onInit={setReactFlowInstance}
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
