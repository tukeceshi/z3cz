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
import Bot from "lucide-react/icons/bot";
import ClipboardPaste from "lucide-react/icons/clipboard-paste";
import Copy from "lucide-react/icons/copy";
import Image from "lucide-react/icons/image";
import Maximize from "lucide-react/icons/maximize";
import Network from "lucide-react/icons/network";
import Scissors from "lucide-react/icons/scissors";
import Trash2 from "lucide-react/icons/trash-2";
import Music from "lucide-react/icons/music";
import Type from "lucide-react/icons/type";
import Video from "lucide-react/icons/video";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { ActionBarButton, ActionBarGroup } from "@/components/ui/action-bar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTranslation } from "@/components/locale-provider";
import { cn, getModifierKey } from "@/utils/utils";

import { AiEditorOverlays } from "./ai-editor-overlays";
import { AiMediaCacheBar } from "./ai-media-cache-panel";
import { CanvasFileDropPreview } from "./canvas-file-drop-preview";
import {
  CanvasShortcutHintButton,
  CanvasShortcutHintPanel,
  useCanvasShortcutHintState,
  useCanvasShortcutHintToolbarLayout,
} from "./canvas-shortcut-hint";
import {
  buildConnectedHandleKeysByNode,
} from "./workflow-connected-handles";
import { WorkflowConnectionLine, WorkflowEdge } from "./workflow-edge";
import { WorkflowNode } from "./workflow-node";
import { WorkflowAddNodeMenu } from "./workflow-add-node-menu";
import type { WorkflowAddNodeMenuState } from "./workflow-add-node-menu";
import { WorkflowAddNodePreviewLine } from "./workflow-add-node-preview-line";
import { WorkflowFlowAttribution } from "./workflow-flow-attribution";
import { WorkflowViewportPersistenceListener } from "./workflow-viewport-persistence-listener";
import { useShiftSelectGate } from "./use-shift-select-gate";
import {
  WORKFLOW_CANVAS_CLASS,
  WORKFLOW_CANVAS_DOT_GAP_PX,
  WORKFLOW_CANVAS_SURFACE,
  WORKFLOW_MULTI_SELECTED_CLASS,
} from "./workflow-canvas-styles";
import type {
  WorkflowEdgeType,
  WorkflowNodeType,
} from "./workflow-types";
import type { CanvasFileDropPreviewState } from "./generative-card-upload-utils";

const nodeTypes = {
  workflowNode: WorkflowNode,
};

const edgeTypes = {
  workflowEdge: WorkflowEdge,
};

const actionBarButtonOutlineClassName =
  "bg-white hover:bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200";

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
  onQuickAddAiNode?: (nodeType: "ai-text" | "ai-image" | "ai-video" | "ai-audio") => void;
  onToggleSidebar?: (e: React.MouseEvent) => void;
  isSidebarVisible?: boolean;
  /** When false, Agent toggle is rendered elsewhere (e.g. floating canvas chrome). */
  showAgentToggle?: boolean;
  /** When true, top action bar sits below floating canvas chrome. */
  reserveTopChromeSpace?: boolean;
  showControls?: boolean;
  isValidConnection?: IsValidConnection<ReactFlowEdge<WorkflowEdgeType>>;
  disabled?: boolean;
  onFitToScreen?: (e: React.MouseEvent) => void;
  onZoomOneToOne?: (e: React.MouseEvent) => void;
  selectedNodes: ReactFlowNode<WorkflowNodeType>[];
  selectedEdges: ReactFlowEdge<WorkflowEdgeType>[];
  onDeleteSelected?: (e: React.MouseEvent) => void;
  onApplyLayout?: () => void;
  onCopySelected?: () => void;
  onCutSelected?: () => void;
  onPasteFromClipboard?: () => void;
  hasClipboardData?: boolean;
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

interface SidebarToggleProps {
  onClick: (e: React.MouseEvent) => void;
  isSidebarVisible: boolean;
}

function SidebarToggle({ onClick, isSidebarVisible }: SidebarToggleProps) {
  const { t } = useTranslation();
  return (
    <ActionBarButton
      onClick={onClick}
      tooltipSide="bottom"
      tooltip={
        isSidebarVisible ? t("workflow.canvas.hideAgent") : t("workflow.canvas.showAgent")
      }
      className={actionBarButtonOutlineClassName}
    >
      <span className="inline-flex items-center gap-2">
        <Bot className="size-4 shrink-0" />
        <span className="text-sm font-medium">{t("workflow.canvas.agent")}</span>
      </span>
    </ActionBarButton>
  );
}

function FitToScreenButton({
  onClick,
}: {
  onClick: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <ActionBarButton
      onClick={onClick}
      className={actionBarButtonOutlineClassName}
      tooltipSide="top"
      tooltip={t("workflow.canvas.fitToScreen")}
    >
      <Maximize className="size-4!" />
    </ActionBarButton>
  );
}

function ZoomOneToOneButton({
  onClick,
}: {
  onClick: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <ActionBarButton
      onClick={onClick}
      className={actionBarButtonOutlineClassName}
      tooltipSide="top"
      tooltip={t("workflow.canvas.zoomOneToOne")}
    >
      <span className="px-0.5 text-[11px] font-semibold leading-none tracking-tight">
        1:1
      </span>
    </ActionBarButton>
  );
}

function DeleteButton({
  onClick,
  disabled,
}: {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ActionBarButton
      onClick={onClick}
      disabled={disabled}
      className={actionBarButtonOutlineClassName}
      tooltipSide="top"
      tooltip={
        <div className="flex items-center gap-2">
          <span>{t("workflow.canvas.delete")}</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.25 text-xs rounded border font-mono">
              Delete
            </kbd>
          </div>
        </div>
      }
    >
      <Trash2 className="size-4!" />
    </ActionBarButton>
  );
}

function ApplyLayoutButton({
  onClick,
  disabled,
}: {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ActionBarButton
      onClick={onClick}
      disabled={disabled}
      className={actionBarButtonOutlineClassName}
      tooltipSide="top"
      tooltip={<p>{t("workflow.canvas.reorganizeLayout")}</p>}
    >
      <Network className="size-4!" />
    </ActionBarButton>
  );
}

function QuickAddAiNodeButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <ActionBarButton
      onClick={onClick}
      disabled={disabled}
      tooltip={label}
      className={actionBarButtonOutlineClassName}
      tooltipSide="top"
    >
      {icon}
    </ActionBarButton>
  );
}

function CopyButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const modifierKey = getModifierKey();
  return (
    <ActionBarButton
      onClick={onClick}
      disabled={disabled}
      className={actionBarButtonOutlineClassName}
      tooltipSide="top"
      tooltip={
        <div className="flex items-center gap-2">
          <span>{t("workflow.canvas.copy")}</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.25 text-xs rounded border font-mono">
              {modifierKey}
            </kbd>
            <kbd className="px-1 py-0.25 text-xs rounded border font-mono">
              C
            </kbd>
          </div>
        </div>
      }
    >
      <Copy className="size-4!" />
    </ActionBarButton>
  );
}

function CutButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const modifierKey = getModifierKey();
  return (
    <ActionBarButton
      onClick={onClick}
      disabled={disabled}
      className={actionBarButtonOutlineClassName}
      tooltipSide="top"
      tooltip={
        <div className="flex items-center gap-2">
          <span>{t("workflow.canvas.cut")}</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.25 text-xs rounded border font-mono">
              {modifierKey}
            </kbd>
            <kbd className="px-1 py-0.25 text-xs rounded border font-mono">
              X
            </kbd>
          </div>
        </div>
      }
    >
      <Scissors className="size-4!" />
    </ActionBarButton>
  );
}

function PasteButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const modifierKey = getModifierKey();
  return (
    <ActionBarButton
      onClick={onClick}
      disabled={disabled}
      className={actionBarButtonOutlineClassName}
      tooltipSide="top"
      tooltip={
        <div className="flex items-center gap-2">
          <span>{t("workflow.canvas.paste")}</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.25 text-xs rounded border font-mono">
              {modifierKey}
            </kbd>
            <kbd className="px-1 py-0.25 text-xs rounded border font-mono">
              V
            </kbd>
          </div>
        </div>
      }
    >
      <ClipboardPaste className="size-4!" />
    </ActionBarButton>
  );
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
  onToggleSidebar,
  isSidebarVisible,
  showAgentToggle = true,
  reserveTopChromeSpace = false,
  showControls = true,
  isValidConnection,
  disabled = false,
  onFitToScreen,
  onZoomOneToOne,
  selectedNodes,
  selectedEdges,
  onDeleteSelected,
  onApplyLayout,
  onCopySelected,
  onCutSelected,
  onPasteFromClipboard,
  hasClipboardData = false,
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
  const { t } = useTranslation();
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const newNodeToolbarRef = useRef<HTMLDivElement>(null);
  const operationsToolbarRef = useRef<HTMLDivElement>(null);
  const keyboardToolbarRef = useRef<HTMLDivElement>(null);
  const layoutToolbarRef = useRef<HTMLDivElement>(null);
  const {
    collapsed: shortcutHintCollapsed,
    setCollapsed: setShortcutHintCollapsed,
    toggle: toggleShortcutHint,
  } = useCanvasShortcutHintState();
  const shortcutHintToolbarLayout = useCanvasShortcutHintToolbarLayout({
    toolbarRef,
    newNodeRef: newNodeToolbarRef,
    operationsRef: operationsToolbarRef,
    keyboardRef: keyboardToolbarRef,
    layoutRef: layoutToolbarRef,
  });
  const [displayNodes, setDisplayNodes] =
    useState<ReactFlowNode<WorkflowNodeType>[]>(nodes);
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

  // Get selected elements for button states
  const hasSelectedElements =
    selectedNodes.length > 0 || selectedEdges.length > 0;
  const hasSelectedNodes = selectedNodes.length > 0;

  return (
    <TooltipProvider>
      <div
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
        onPaneClick={onPaneClick}
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

        {!disabled && (
          <AiEditorOverlays nodes={displayNodes} />
        )}

        {showControls &&
          showAgentToggle &&
          onToggleSidebar &&
          isSidebarVisible !== undefined && (
            <div
              className={cn(
                "absolute right-4 flex items-center gap-3 z-50",
                reserveTopChromeSpace ? "top-14" : "top-4"
              )}
            >
              <ActionBarGroup>
                <SidebarToggle
                  onClick={onToggleSidebar}
                  isSidebarVisible={isSidebarVisible}
                />
              </ActionBarGroup>
            </div>
          )}

        {showControls && (
          <Panel
            position="bottom-center"
            className="m-4"
          >
            <div
              ref={toolbarRef}
              className="relative flex flex-row items-center gap-2"
            >
              {!disabled && !shortcutHintCollapsed && (
                <CanvasShortcutHintPanel
                  layout={shortcutHintToolbarLayout}
                  onClose={() => setShortcutHintCollapsed(true)}
                />
              )}

              <div ref={newNodeToolbarRef} className="shrink-0">
                <ActionBarGroup>
                  {onQuickAddAiNode && (
                    <>
                      <QuickAddAiNodeButton
                        label={t("workflow.canvas.aiText")}
                        icon={<Type className="size-4!" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAddAiNode("ai-text");
                        }}
                        disabled={disabled}
                      />
                      <QuickAddAiNodeButton
                        label={t("workflow.canvas.aiImage")}
                        icon={<Image className="size-4!" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAddAiNode("ai-image");
                        }}
                        disabled={disabled}
                      />
                      <QuickAddAiNodeButton
                        label={t("workflow.canvas.aiVideo")}
                        icon={<Video className="size-4!" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAddAiNode("ai-video");
                        }}
                        disabled={disabled}
                      />
                      <QuickAddAiNodeButton
                        label={t("workflow.canvas.aiAudio")}
                        icon={<Music className="size-4!" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAddAiNode("ai-audio");
                        }}
                        disabled={disabled}
                      />
                    </>
                  )}
                </ActionBarGroup>
              </div>

              <div ref={operationsToolbarRef} className="shrink-0">
                <ActionBarGroup>
                  {onCopySelected && (
                    <CopyButton onClick={onCopySelected} disabled={disabled || !hasSelectedNodes} />
                  )}
                  {onCutSelected && (
                    <CutButton onClick={onCutSelected} disabled={disabled || !hasSelectedNodes} />
                  )}
                  {onPasteFromClipboard && (
                    <PasteButton onClick={onPasteFromClipboard} disabled={disabled || !hasClipboardData} />
                  )}
                  {onDeleteSelected && (
                    <DeleteButton onClick={onDeleteSelected} disabled={disabled || !hasSelectedElements} />
                  )}
                </ActionBarGroup>
              </div>

              {!disabled && (
                <div ref={keyboardToolbarRef} className="shrink-0">
                  <ActionBarGroup>
                    <CanvasShortcutHintButton
                      collapsed={shortcutHintCollapsed}
                      onToggle={(event) => {
                        event.stopPropagation();
                        toggleShortcutHint();
                      }}
                    />
                  </ActionBarGroup>
                </div>
              )}

              {!disabled && (onApplyLayout || onFitToScreen || onZoomOneToOne) && (
                <div ref={layoutToolbarRef} className="shrink-0">
                  <ActionBarGroup>
                    {onApplyLayout && (
                      <ApplyLayoutButton onClick={() => onApplyLayout()} disabled={disabled || nodes.length === 0} />
                    )}
                    {onFitToScreen && <FitToScreenButton onClick={onFitToScreen} />}
                    {onZoomOneToOne && (
                      <ZoomOneToOneButton onClick={onZoomOneToOne} />
                    )}
                  </ActionBarGroup>
                </div>
              )}
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
