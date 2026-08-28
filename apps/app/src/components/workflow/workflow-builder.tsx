import type {
  AiGenerativeNodeType,
  Edge as BackendEdge,
  Node as BackendNode,
  ObjectReference,
  Parameter,
  WorkflowEditorViewport,
  WorkflowGenerativeDefaults,
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
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Spinner } from "@/components/ui/spinner";
import { useAppToast } from "@/hooks/use-app-toast";
import { useGenerativeMediaBeforeUnloadGuard } from "@/hooks/use-generative-media-before-unload";
import { executeWorkflowNode } from "@/services/workflow-service";
import { cn } from "@/utils/utils";

import { DetachNodesConfirmDialog } from "./detach-nodes-confirm-dialog";
import { writeSkipDetachWithRecordsConfirm } from "./detach-confirm-preference";
import type { DetachConfirmSource, PendingDetachConfirm } from "./use-graph-history";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import { useWorkflowState } from "./use-workflow-state";
import { useOptionalCanvasMaintenance } from "@/contexts/canvas-maintenance-context";
import { InlineAiTextMigrationHost } from "./inline-ai-text-migration-host";
import { WorkflowCanvas } from "./workflow-canvas";
import { CloudStorageCanvasProvider } from "./cloud-storage-canvas-provider";
import {
  CreativeStudioProvider,
  useCreativeStudio,
  type GenerativeNodeAddOptions,
} from "./creative-studio-context";
import { STUDIO_SHELL } from "./creative-studio-surface";
import type { AddGenerativeNodesBatchItem } from "./use-graph-operations";
import { useCanvasGenerativeFileDrop } from "./studio-generative-file-upload";
import { useCanvasDropNodeSelection } from "./use-canvas-drop-node-selection";
import { WorkflowProvider } from "./workflow-context";
import { VideoTrimSessionProvider, useVideoTrimSession } from "./video-trim-session-context";
import { WorkflowEditorCanvasChrome } from "./workflow-editor-canvas-chrome";
import { WorkflowSettingsDialog } from "./workflow-settings-dialog";
import {
  isValidWorkflowEditorViewport,
  restoreEditorViewportWhenPaneStable,
  viewportNearlyEqual,
} from "./workflow-viewport-utils";
import type {
  NodeType,
  WorkflowEdgeType,
  WorkflowNodeType,
} from "./workflow-types";

const CreativeStudioView = lazy(() =>
  import("./creative-studio-view").then((module) => ({
    default: module.CreativeStudioView,
  }))
);

function prefetchCreativeStudioView(): void {
  void import("./creative-studio-view");
}

function usePrefetchCreativeStudioView(): void {
  useEffect(() => {
    const run = () => prefetchCreativeStudioView();
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = window.setTimeout(run, 500);
    return () => window.clearTimeout(timeoutId);
  }, []);
}

function CreativeStudioLoadingFallback() {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 items-center justify-center",
        STUDIO_SHELL
      )}
    >
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}

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
  initialNodes?: ReactFlowNode<WorkflowNodeType>[];
  initialEdges?: ReactFlowEdge<WorkflowEdgeType>[];
  nodeTypes?: NodeType[];
  onNodesChange?: (nodes: ReactFlowNode<WorkflowNodeType>[]) => void;
  onEdgesChange?: (edges: ReactFlowEdge<WorkflowEdgeType>[]) => void;
  validateConnection?: (connection: Connection) => boolean;
  mode?: WorkflowBuilderMode;
  createObjectUrl: (objectReference: ObjectReference) => string;
  workflowName?: string;
  workflowDescription?: string;
  onWorkflowUpdate?: (name: string, description?: string) => void;
  orgId: string;
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
  initialNodes = [],
  initialEdges = [],
  nodeTypes = [],
  onNodesChange: onNodesChangeFromParent,
  onEdgesChange: onEdgesChangeFromParent,
  validateConnection,
  mode = "edit",
  createObjectUrl,
  workflowName,
  workflowDescription,
  onWorkflowUpdate,
  orgId,
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
  const canvasMaintenance = useOptionalCanvasMaintenance();
  const isCanvasFrozen = canvasMaintenance?.isCanvasFrozen ?? false;
  const interactive = mode !== "preview";

  const allowedNodeTypes = useMemo(
    () => buildCatalogAllowedNodeTypeSet(nodeTypes),
    [nodeTypes]
  );

  const suppressViewportPersistEndRef = useRef(false);

  const [detachConfirmOpen, setDetachConfirmOpen] = useState(false);
  const [detachConfirmSource, setDetachConfirmSource] =
    useState<DetachConfirmSource | null>(null);
  const [detachConfirmNodeCount, setDetachConfirmNodeCount] = useState(0);
  const [detachConfirmDontAsk, setDetachConfirmDontAsk] = useState(false);
  const detachConfirmPendingRef = useRef<PendingDetachConfirm | null>(null);

  const requestDetachConfirm = useCallback((pending: PendingDetachConfirm) => {
    detachConfirmPendingRef.current = pending;
    setDetachConfirmSource(pending.source);
    setDetachConfirmNodeCount(pending.nodeIds.length);
    setDetachConfirmDontAsk(false);
    setDetachConfirmOpen(true);
  }, []);

  const handleDetachConfirmOpenChange = useCallback((open: boolean) => {
    setDetachConfirmOpen(open);
    if (!open) {
      detachConfirmPendingRef.current = null;
      setDetachConfirmSource(null);
      setDetachConfirmNodeCount(0);
      setDetachConfirmDontAsk(false);
    }
  }, []);

  const handleDetachConfirm = useCallback(() => {
    if (detachConfirmDontAsk) {
      writeSkipDetachWithRecordsConfirm(true);
    }
    detachConfirmPendingRef.current?.proceed();
    detachConfirmPendingRef.current = null;
    setDetachConfirmOpen(false);
    setDetachConfirmSource(null);
    setDetachConfirmNodeCount(0);
    setDetachConfirmDontAsk(false);
  }, [detachConfirmDontAsk]);

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
    addGenerativeNodesBatch,
    updateNodeExecution,
    setReactFlowInstance,
    reactFlowInstance,
    isValidConnection,
    updateNodeData,
    updateEdgeData,
    deleteEdge,
    deleteNode,
    deleteSelected,
    selectNode,
    selectNodes,
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
    undo,
    redo,
    canUndo,
    canRedo,
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
    requestDetachConfirm,
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
      options?: GenerativeNodeAddOptions
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
        positionFlowPoint: options?.positionFlowPoint,
        manualContent: options?.manualContent,
        selected: options?.selected,
      });
    },
    [appToast, handleNodeSelect, nodeTypes]
  );

  const requestDeleteSelected = useCallback(() => {
    if (readOnly) return;
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
    deleteSelected();
  }, [deleteSelected, readOnly, selectedEdges.length, selectedNodes.length]);

  const requestDeleteStudioNode = useCallback(
    (nodeId: string) => {
      if (readOnly) return;
      deleteNode(nodeId);
    },
    [deleteNode, readOnly]
  );

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
      viewport: WorkflowEditorViewport,
      options?: { readonly force?: boolean }
    ) => {
      const viewportKey = JSON.stringify(viewport);
      if (!options?.force && appliedViewportKeyRef.current === viewportKey) {
        return;
      }

      const live = instance.getViewport();
      if (!options?.force && viewportNearlyEqual(live, viewport)) {
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

  const restoreEditorViewportAfterStudio = useCallback(() => {
    if (
      !reactFlowInstance ||
      !savedEditorViewport ||
      !isValidWorkflowEditorViewport(savedEditorViewport)
    ) {
      return;
    }
    restoreSavedEditorViewport(reactFlowInstance, savedEditorViewport, {
      force: true,
    });
  }, [reactFlowInstance, restoreSavedEditorViewport, savedEditorViewport]);

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
          onReturnToCanvasFromDetail={handleReturnToCanvas}
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
            requestDeleteSelected={requestDeleteSelected}
            requestDeleteStudioNode={requestDeleteStudioNode}
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
          <CreativeStudioCanvasSync selectNode={selectNode} />
          <div className="relative flex min-h-0 flex-1 flex-col">
          <CloudStorageCanvasProvider orgId={orgId} enabled={!readOnly && !isCanvasFrozen}>
          <VideoTrimSessionProvider>
            <InlineAiTextMigrationHost
              organizationId={orgId}
              workflowId={workflowId}
              graphReady={graphReady}
              nodes={nodes}
              setNodes={setNodes}
            />
            <div className="relative flex min-h-0 flex-1">
              {workflowsListUrl ? (
                <WorkflowEditorCanvasChrome
                  workflowName={workflowName ?? ""}
                  workflowsListUrl={workflowsListUrl}
                  readOnly={readOnly}
                  onOpenWorkflowSettings={onOpenWorkflowSettings}
                  soleSelectedNodeId={soleSelectedNodeId}
                />
              ) : null}
              <div
                className={cn(
                  "h-full w-full overflow-hidden relative",
                  !canvasRevealed && "invisible"
                )}
              >
                <WorkflowEditorMainArea
                  nodes={nodes}
                  edges={edges}
                  reactFlowInstance={reactFlowInstance}
                  canvasFileDropEnabled={!readOnly && interactive && !isCanvasFrozen}
                  onAddCanvasDropNodes={readOnly ? undefined : addGenerativeNodesBatch}
                  onSelectDroppedNodes={readOnly ? undefined : selectNodes}
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
                  onUndo={readOnly ? undefined : undo}
                  onRedo={readOnly ? undefined : redo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  reserveTopChromeSpace={Boolean(workflowsListUrl)}
                  isValidConnection={isValidConnection}
                  disabled={readOnly}
                  onFitToScreen={handleFitToScreen}
                  onZoomOneToOne={handleZoomOneToOne}
                  selectedNodes={selectedNodes}
                  selectedEdges={selectedEdges}
                  onApplyLayout={readOnly ? undefined : applyLayout}
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
                  onRestoreEditorViewportAfterStudio={
                    restoreEditorViewportAfterStudio
                  }
                  soleSelectedNodeId={soleSelectedNodeId}
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
            </div>

          <WorkflowSettingsDialog
            open={workflowSettingsOpen}
            onOpenChange={onWorkflowSettingsOpenChange ?? (() => {})}
            workflowName={workflowName}
            workflowDescription={workflowDescription}
            onWorkflowUpdate={readOnly ? undefined : onWorkflowUpdate}
            disabledWorkflow={readOnly}
          />
          </VideoTrimSessionProvider>
          </CloudStorageCanvasProvider>
        </div>

        <DetachNodesConfirmDialog
          open={detachConfirmOpen}
          source={detachConfirmSource}
          nodeCount={detachConfirmNodeCount}
          dontAskAgain={detachConfirmDontAsk}
          onDontAskAgainChange={setDetachConfirmDontAsk}
          onOpenChange={handleDetachConfirmOpenChange}
          onConfirm={handleDetachConfirm}
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
  requestDeleteSelected,
  requestDeleteStudioNode,
  undo,
  redo,
  canUndo,
  canRedo,
}: {
  readonly readOnly: boolean;
  readonly selectedNodes: ReactFlowNode<WorkflowNodeType>[];
  readonly selectedEdges: ReactFlowEdge<WorkflowEdgeType>[];
  readonly hasClipboardData: boolean;
  readonly copySelected: () => void;
  readonly cutSelected: () => void;
  readonly pasteFromClipboard: () => void;
  readonly requestDeleteSelected: () => void;
  readonly requestDeleteStudioNode: (nodeId: string) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
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
    requestDeleteSelected: requestDeleteActive,
    hasStudioNodeSelected,
    undo,
    redo,
    canUndo,
    canRedo,
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

type WorkflowEditorMainAreaProps = ComponentProps<typeof WorkflowCanvas> & {
  readonly reactFlowInstance: ReactFlowInstance | null;
  readonly canvasFileDropEnabled: boolean;
  readonly onAddCanvasDropNodes?: (
    items: readonly AddGenerativeNodesBatchItem[]
  ) => readonly string[];
  readonly onSelectDroppedNodes?: (nodeIds: readonly string[]) => void;
  /** When true, studio overlay sits below floating canvas chrome. */
  readonly reserveTopChromeSpace?: boolean;
  readonly onRestoreEditorViewportAfterStudio?: () => void;
};

function WorkflowEditorMainArea({
  reactFlowInstance,
  canvasFileDropEnabled,
  onAddCanvasDropNodes,
  onSelectDroppedNodes,
  reserveTopChromeSpace = false,
  suppressViewportPersistEndRef,
  onRestoreEditorViewportAfterStudio,
  onPaneClick,
  ...props
}: WorkflowEditorMainAreaProps) {
  useGenerativeMediaBeforeUnloadGuard();
  usePrefetchCreativeStudioView();
  const { viewMode } = useCreativeStudio();
  const { closeTrimSession } = useVideoTrimSession();
  const handlePaneClick = useCallback(() => {
    closeTrimSession();
    onPaneClick?.();
  }, [closeTrimSession, onPaneClick]);
  const selectDroppedNodes = useCanvasDropNodeSelection(
    onSelectDroppedNodes ?? (() => {})
  );
  const {
    fileDropPreview,
    handleCanvasDragOver,
    handleCanvasDragLeave,
    handleCanvasDrop,
    handleCanvasFilePick,
  } = useCanvasGenerativeFileDrop({
      reactFlowInstance,
      enabled: canvasFileDropEnabled && viewMode === "canvas",
      onAddCanvasDropNodes,
      onSelectDroppedNodes: onSelectDroppedNodes ? selectDroppedNodes : undefined,
    });

  const isStudio = viewMode === "studio";
  const wasStudioRef = useRef(isStudio);

  useEffect(() => {
    if (wasStudioRef.current && !isStudio) {
      if (suppressViewportPersistEndRef) {
        suppressViewportPersistEndRef.current = true;
      }
      onRestoreEditorViewportAfterStudio?.();
    }
    wasStudioRef.current = isStudio;
  }, [
    isStudio,
    onRestoreEditorViewportAfterStudio,
    suppressViewportPersistEndRef,
  ]);

  return (
    <div className="relative h-full w-full min-h-0">
      <WorkflowCanvas
        {...props}
        onPaneClick={onPaneClick ? handlePaneClick : undefined}
        suppressViewportPersistEndRef={suppressViewportPersistEndRef}
        parked={isStudio}
        disabled={Boolean(props.disabled) || isStudio}
        showControls={isStudio ? false : props.showControls}
        canvasFileDropPreview={fileDropPreview}
        onCanvasFileDragOver={handleCanvasDragOver}
        onCanvasFileDragLeave={handleCanvasDragLeave}
        onCanvasFileDrop={handleCanvasDrop}
        onPickCanvasFiles={
          canvasFileDropEnabled && viewMode === "canvas"
            ? handleCanvasFilePick
            : undefined
        }
      />

      {isStudio ? (
        <div
          className={cn(
            "absolute z-50",
            reserveTopChromeSpace
              ? "inset-x-0 bottom-0 top-14"
              : "inset-0"
          )}
        >
          <Suspense fallback={<CreativeStudioLoadingFallback />}>
            <CreativeStudioView />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}
