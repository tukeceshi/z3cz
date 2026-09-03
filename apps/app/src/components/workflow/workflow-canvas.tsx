import "@xyflow/react/dist/style.css";

import type {
  IsValidConnection,
  NodeChange,
  OnConnect,
  OnConnectEnd,
  OnConnectStart,
  OnEdgesChange,
  OnNodesChange,
  Edge as ReactFlowEdge,
  ReactFlowInstance,
  Node as ReactFlowNode,
  Viewport,
} from "@xyflow/react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Panel,
  ReactFlow,
} from "@xyflow/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/utils/utils";

import { AiEditorOverlays } from "./ai-editor-overlays";
import { AiMediaCacheBar } from "./ai-media-cache-panel";
import { useCanvasBottomToolbarLayout } from "./canvas-bottom-toolbar-layout";
import { CanvasFileDropPreview } from "./canvas-file-drop-preview";
import {
  CanvasShortcutHintPanel,
  useCanvasShortcutHintArrowOffset,
  useCanvasShortcutHintState,
} from "./canvas-shortcut-hint";
import type { CanvasFileDropPreviewState } from "./generative-card-upload-utils";
import { useShiftSelectGate } from "./use-shift-select-gate";
import type { WorkflowAddNodeMenuState } from "./workflow-add-node-menu";
import { WorkflowAddNodeMenu } from "./workflow-add-node-menu";
import { WorkflowAddNodePreviewLine } from "./workflow-add-node-preview-line";
import type { WorkflowAgentSettingsOverlayHandle } from "./workflow-agent-settings-overlay";
import { WorkflowAgentSettingsOverlay } from "./workflow-agent-settings-overlay";
import { WorkflowCanvasBottomToolbar } from "./workflow-canvas-bottom-toolbar";
import {
  WORKFLOW_CANVAS_CLASS,
  WORKFLOW_CANVAS_DOT_GAP_PX,
  WORKFLOW_CANVAS_SURFACE,
  WORKFLOW_MULTI_SELECTED_CLASS,
} from "./workflow-canvas-styles";
import { buildConnectedHandleKeysByNode } from "./workflow-connected-handles";
import { WorkflowConnectionLine, WorkflowEdge } from "./workflow-edge";
import { WorkflowFlowAttribution } from "./workflow-flow-attribution";
import { WorkflowNode } from "./workflow-node";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";
import { WorkflowViewportPersistenceListener } from "./workflow-viewport-persistence-listener";

const nodeTypes = {
  workflowNode: WorkflowNode,
};

const edgeTypes = {
  workflowEdge: WorkflowEdge,
};

export interface WorkflowCanvasProps {
  nodes: ReactFlowNode<WorkflowNodeType>[];
  edges: ReactFlowEdge<WorkflowEdgeType>[];
  onNodesChange: OnNodesChange<ReactFlowNode<WorkflowNodeType>>;
  onEdgesChange: OnEdgesChange<ReactFlowEdge<WorkflowEdgeType>>;
  onConnect: OnConnect;
  onConnectStart: OnConnectStart;
  onConnectEnd: OnConnectEnd;
  onNodeDragStart?: () => void;
  onNodeDragStop: (
    event: React.MouseEvent,
    node: ReactFlowNode<WorkflowNodeType>
  ) => void;
  isDraggingRef?: React.RefObject<boolean>;
  onNodeDoubleClick?: (event: React.MouseEvent) => void;
  onMoveStart?: () => void;
  onMoveEnd?: () => void;
  onInit: (
    instance: ReactFlowInstance<
      ReactFlowNode<WorkflowNodeType>,
      ReactFlowEdge<WorkflowEdgeType>
    >
  ) => void;
  onQuickAddAiNode?: (
    nodeType: "ai-text" | "ai-image" | "ai-video" | "ai-audio"
  ) => void;
  onPickCanvasFiles?: (files: readonly File[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  showControls?: boolean;
  isValidConnection?: IsValidConnection<ReactFlowEdge<WorkflowEdgeType>>;
  disabled?: boolean;
  onFitToScreen?: (e: React.MouseEvent) => void;
  onZoomOneToOne?: (e: React.MouseEvent) => void;
  selectedNodes: ReactFlowNode<WorkflowNodeType>[];
  selectedEdges: ReactFlowEdge<WorkflowEdgeType>[];
  onApplyLayout?: () => void;
  showBackground?: boolean;
  /** Padding for React Flow's `fitView`. Defaults to 0.25. */
  fitViewPadding?: number;
  /** Skip mount-time fitView; caller sets viewport in onInit instead. */
  skipInitialFitView?: boolean;
  /** Initial React Flow viewport when restoring a saved editor position. */
  defaultViewport?: Viewport;
  onEditorViewportChange?: (viewport: Viewport) => void;
  onEditorViewportGestureEnd?: (viewport: Viewport) => void;
  suppressViewportPersistEndRef?: React.RefObject<boolean>;
  soleSelectedNodeId?: string | null;
  addNodeMenu?: WorkflowAddNodeMenuState | null;
  onAddNodeMenuSelect?: (
    nodeType: "ai-text" | "ai-image" | "ai-video" | "ai-audio",
    menu: WorkflowAddNodeMenuState
  ) => void;
  onCloseAddNodeMenu?: () => void;
  onPaneClick?: () => void;
  onPaneContextMenu?: (event: React.MouseEvent) => void;
  canvasFileDropPreview?: CanvasFileDropPreviewState;
  onCanvasFileDragOver?: (event: React.DragEvent) => void;
  onCanvasFileDragLeave?: (event: React.DragEvent) => void;
  onCanvasFileDrop?: (event: React.DragEvent) => void;
  /** Shrink the live pane to 1×1 so off-screen nodes unmount; do not persist. */
  parked?: boolean;
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onConnectStart,
  onConnectEnd,
  onNodeDoubleClick,
  onNodeDragStart,
  onNodeDragStop,
  isDraggingRef,
  onMoveStart,
  onMoveEnd,
  onInit,
  onQuickAddAiNode,
  onPickCanvasFiles,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  showControls = true,
  isValidConnection,
  disabled = false,
  onFitToScreen,
  onZoomOneToOne,
  selectedNodes,
  onApplyLayout,
  showBackground = true,
  fitViewPadding = 0.25,
  skipInitialFitView = false,
  defaultViewport,
  onEditorViewportChange,
  onEditorViewportGestureEnd,
  suppressViewportPersistEndRef,
  soleSelectedNodeId = null,
  addNodeMenu = null,
  onAddNodeMenuSelect,
  onCloseAddNodeMenu,
  onPaneClick,
  onPaneContextMenu,
  canvasFileDropPreview,
  onCanvasFileDragOver,
  onCanvasFileDragLeave,
  onCanvasFileDrop,
  parked = false,
}: WorkflowCanvasProps) {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const agentChromeRef = useRef<HTMLDivElement>(null);
  const agentOverlayRef = useRef<WorkflowAgentSettingsOverlayHandle>(null);
  const [remotionViewportOpen, setRemotionViewportOpen] = useState(false);
  const toolbarPanelRef = useRef<HTMLDivElement>(null);
  const shortcutHintAnchorRef = useRef<HTMLDivElement>(null);
  const keyboardToolbarRef = useRef<HTMLDivElement>(null);
  const {
    collapsed: shortcutHintCollapsed,
    setCollapsed: setShortcutHintCollapsed,
    toggle: toggleShortcutHint,
  } = useCanvasShortcutHintState();
  const shortcutHintArrowLeftPx = useCanvasShortcutHintArrowOffset({
    anchorRef: shortcutHintAnchorRef,
    keyboardRef: keyboardToolbarRef,
  });
  const bottomToolbarPanelStyle = useCanvasBottomToolbarLayout({
    enabled: showControls,
    shellRef: canvasShellRef,
    agentRef: agentChromeRef,
    toolbarPanelRef,
  });
  const [displayNodes, setDisplayNodes] =
    useState<ReactFlowNode<WorkflowNodeType>[]>(nodes);
  const getCanvasGraph = useCallback(() => ({ nodes, edges }), [nodes, edges]);
  const blockCardInteraction = useShiftSelectGate(selectedNodes.length);

  useEffect(() => {
    if (!isDraggingRef?.current) {
      setDisplayNodes(nodes);
    }
  }, [nodes, isDraggingRef]);

  const connectedKeysByNode = useMemo(
    () => buildConnectedHandleKeysByNode(edges),
    [edges]
  );

  const renderNodes = useMemo(() => {
    const baseNodes = isDraggingRef?.current ? displayNodes : nodes;

    return baseNodes.map((node) => {
      const handleKeys = connectedKeysByNode.get(node.id) ?? [];
      const isHost = node.id === soleSelectedNodeId;

      return {
        ...node,
        data: {
          ...node.data,
          connectedHandleKeys: handleKeys,
          showBottomPanelHost: isHost,
        },
      };
    });
  }, [
    connectedKeysByNode,
    displayNodes,
    nodes,
    isDraggingRef,
    soleSelectedNodeId,
  ]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<ReactFlowNode<WorkflowNodeType>>[]) => {
      if (isDraggingRef?.current) {
        setDisplayNodes((current) => applyNodeChanges(changes, current));
      }
      onNodesChange(changes);
    },
    [onNodesChange, isDraggingRef]
  );

  const handlePaneClick = useCallback(() => {
    agentOverlayRef.current?.dimOnCanvasClick();
    onPaneClick?.();
  }, [onPaneClick]);

  const handleToggleRemotionViewport = useCallback(() => {
    setRemotionViewportOpen((open) => !open);
  }, []);

  const handleOpenRemotionViewport = useCallback(() => {
    setRemotionViewportOpen(true);
  }, []);

  useEffect(() => {
    if (parked) {
      setRemotionViewportOpen(false);
    }
  }, [parked]);

  return (
    <TooltipProvider>
      <div
        ref={canvasShellRef}
        className={cn(
          "relative min-h-0",
          parked ? "h-px w-px overflow-hidden" : "h-full w-full",
          selectedNodes.length > 1 && WORKFLOW_MULTI_SELECTED_CLASS
        )}
      >
        <ReactFlow
          nodes={renderNodes}
          edges={edges}
          proOptions={{ hideAttribution: true }}
          onlyRenderVisibleElements={parked}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onPaneClick={showControls ? handlePaneClick : undefined}
          onPaneContextMenu={onPaneContextMenu}
          onDragOver={onCanvasFileDragOver}
          onDragLeave={onCanvasFileDragLeave}
          onDrop={onCanvasFileDrop}
          onNodeDoubleClick={
            blockCardInteraction ? undefined : onNodeDoubleClick
          }
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onMoveStart={onMoveStart}
          onMoveEnd={onMoveEnd}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Strict}
          connectionLineComponent={WorkflowConnectionLine}
          connectionRadius={8}
          onInit={onInit}
          isValidConnection={isValidConnection}
          {...(defaultViewport ? { defaultViewport } : {})}
          {...(skipInitialFitView
            ? {}
            : {
                fitView: true,
                fitViewOptions: {
                  padding: fitViewPadding,
                  maxZoom: 2,
                },
              })}
          minZoom={0.05}
          maxZoom={4}
          className={cn(
            WORKFLOW_CANVAS_CLASS,
            "h-full w-full",
            showBackground && WORKFLOW_CANVAS_SURFACE,
            disabled && "cursor-default",
            addNodeMenu && "cursor-default"
          )}
          nodesDraggable={!disabled && showControls}
          nodesConnectable={!disabled && showControls && !blockCardInteraction}
          elementsSelectable={showControls}
          selectNodesOnDrag={!disabled && showControls}
          multiSelectionKeyCode={showControls ? "Shift" : undefined}
          deleteKeyCode={null}
          panOnDrag={showControls && !addNodeMenu}
          zoomOnScroll={showControls}
          zoomOnPinch={showControls}
          zoomOnDoubleClick={showControls}
          preventScrolling={showControls}
        >
          {showControls ? (
            <WorkflowFlowAttribution
              aiMediaCache={
                !disabled && organization?.id ? (
                  <AiMediaCacheBar
                    organizationId={organization.id}
                    currentWorkflowId={workflowId}
                  />
                ) : undefined
              }
            />
          ) : null}
          {onEditorViewportChange && (
            <WorkflowViewportPersistenceListener
              disabled={disabled}
              onViewportChange={onEditorViewportChange}
              onViewportGestureEnd={onEditorViewportGestureEnd}
              suppressNextEndRef={suppressViewportPersistEndRef}
            />
          )}
          {showBackground && (
            <Background
              variant={BackgroundVariant.Dots}
              gap={WORKFLOW_CANVAS_DOT_GAP_PX}
              size={1}
              className="stroke-foreground/5 opacity-50 dark:opacity-100"
            />
          )}
          <WorkflowAddNodePreviewLine menu={addNodeMenu} />
          {canvasFileDropPreview?.visible ? (
            <CanvasFileDropPreview preview={canvasFileDropPreview} />
          ) : null}

          {!disabled && <AiEditorOverlays nodes={displayNodes} />}

          {showControls && (
            <Panel position="bottom-left" className="m-4">
              <div ref={agentChromeRef} className="min-w-0">
                <WorkflowAgentSettingsOverlay
                  ref={agentOverlayRef}
                  orgId={organization?.id}
                  workflowId={workflowId}
                  workflowName={workflowId}
                  remotionViewportOpen={remotionViewportOpen}
                  onToggleRemotionViewport={handleToggleRemotionViewport}
                  onOpenRemotionViewport={handleOpenRemotionViewport}
                  onCloseRemotionViewport={() => setRemotionViewportOpen(false)}
                  getCanvasGraph={getCanvasGraph}
                />
              </div>
            </Panel>
          )}

          {showControls && (
            <Panel
              ref={toolbarPanelRef}
              position="bottom-center"
              className="m-4"
              style={bottomToolbarPanelStyle}
            >
              <div className="relative" ref={shortcutHintAnchorRef}>
                {!disabled && !shortcutHintCollapsed && (
                  <CanvasShortcutHintPanel
                    arrowLeftPx={shortcutHintArrowLeftPx}
                    onClose={() => setShortcutHintCollapsed(true)}
                  />
                )}
                <WorkflowCanvasBottomToolbar
                  disabled={disabled}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={onUndo}
                  onRedo={onRedo}
                  onQuickAddAiNode={onQuickAddAiNode}
                  onApplyLayout={onApplyLayout}
                  onFitToScreen={onFitToScreen}
                  onZoomOneToOne={onZoomOneToOne}
                  nodesEmpty={nodes.length === 0}
                  shortcutHintCollapsed={shortcutHintCollapsed}
                  onToggleShortcutHint={(event) => {
                    event.stopPropagation();
                    toggleShortcutHint();
                  }}
                  keyboardRef={keyboardToolbarRef}
                />
              </div>
            </Panel>
          )}
        </ReactFlow>
        {onAddNodeMenuSelect && onCloseAddNodeMenu && (
          <WorkflowAddNodeMenu
            state={addNodeMenu}
            onSelect={onAddNodeMenuSelect}
            onClose={onCloseAddNodeMenu}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
