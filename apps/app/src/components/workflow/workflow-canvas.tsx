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
  Controls,
  Panel,
  ReactFlow,
  useViewport,
} from "@xyflow/react";
import { Plus } from "lucide-react";
import Bot from "lucide-react/icons/bot";
import ClipboardPaste from "lucide-react/icons/clipboard-paste";
import Clock from "lucide-react/icons/clock";
import Copy from "lucide-react/icons/copy";
import Image from "lucide-react/icons/image";
import Layers2 from "lucide-react/icons/layers-2";
import Maximize from "lucide-react/icons/maximize";
import Network from "lucide-react/icons/network";
import Play from "lucide-react/icons/play";
import Scissors from "lucide-react/icons/scissors";
import Square from "lucide-react/icons/square";
import Trash2 from "lucide-react/icons/trash-2";
import Music from "lucide-react/icons/music";
import Type from "lucide-react/icons/type";
import Video from "lucide-react/icons/video";
import X from "lucide-react/icons/x";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { ActionBarButton, ActionBarGroup } from "@/components/ui/action-bar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { cn, getModifierKey, getModifierSymbol } from "@/utils/utils";

import { AiEditorOverlays } from "./ai-editor-overlays";
import {
  buildConnectedHandleKeysByNode,
} from "./workflow-connected-handles";
import { WorkflowConnectionLine, WorkflowEdge } from "./workflow-edge";
import { WorkflowNode } from "./workflow-node";
import { WorkflowAddNodeMenu } from "./workflow-add-node-menu";
import type { WorkflowAddNodeMenuState } from "./workflow-add-node-menu";
import { WorkflowAddNodePreviewLine } from "./workflow-add-node-preview-line";
import { WorkflowViewportPersistenceListener } from "./workflow-viewport-persistence-listener";
import {
  WORKFLOW_CANVAS_CLASS,
  WORKFLOW_CANVAS_DOT_GAP_PX,
} from "./workflow-canvas-styles";
import type {
  ConnectionValidationState,
  WorkflowEdgeType,
  WorkflowExecutionStatus,
  WorkflowNodeType,
} from "./workflow-types";

const nodeTypes = {
  workflowNode: WorkflowNode,
};

const edgeTypes = {
  workflowEdge: WorkflowEdge,
};

const actionBarButtonOutlineClassName =
  "bg-white hover:bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200";

interface StatusBarProps {
  workflowStatus: WorkflowExecutionStatus;
  errorMessage?: string;
}

function StatusBar({ workflowStatus, errorMessage }: StatusBarProps) {
  const { t } = useTranslation();

  const statusStyles: Record<
    WorkflowExecutionStatus,
    { color: string; bg: string; labelKey: TranslationKey }
  > = {
    idle: {
      color: "text-neutral-600 dark:text-neutral-400",
      bg: "bg-neutral-200 dark:bg-neutral-700",
      labelKey: "workflow.status.idle",
    },
    submitted: {
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-200 dark:bg-orange-900/50",
      labelKey: "workflow.status.submitted",
    },
    executing: {
      color: "text-yellow-600 dark:text-yellow-400",
      bg: "bg-yellow-400 dark:bg-yellow-500",
      labelKey: "workflow.status.executing",
    },
    completed: {
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-200 dark:bg-green-900/50",
      labelKey: "workflow.status.completed",
    },
    error: {
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-200 dark:bg-red-900/50",
      labelKey: "workflow.status.error",
    },
    cancelled: {
      color: "text-neutral-600 dark:text-neutral-400",
      bg: "bg-neutral-200 dark:bg-neutral-700",
      labelKey: "workflow.status.cancelled",
    },
    paused: {
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-200 dark:bg-blue-900/50",
      labelKey: "workflow.status.paused",
    },
    exhausted: {
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-200 dark:bg-red-900/50",
      labelKey: "workflow.status.exhausted",
    },
  };

  const config = statusStyles[workflowStatus] || statusStyles.idle;

  return (
    <div className="absolute bottom-4 left-4 flex items-center gap-3 z-50">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 shadow-xs flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", config.bg)}>
            <div className={cn("w-full h-full rounded-full")} />
          </div>
          <span className={cn("text-sm font-medium", config.color)}>
            {t(config.labelKey)}
          </span>
        </div>

        {workflowStatus === "error" && errorMessage ? (
          <>
            <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-600" />
            <span className="text-sm text-red-600 dark:text-red-400 max-w-md truncate">
              {errorMessage}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

export interface WorkflowCanvasProps {
  nodes: ReactFlowNode<WorkflowNodeType>[];
  edges: ReactFlowEdge<WorkflowEdgeType>[];
  connectionValidationState?: ConnectionValidationState;
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
  onAddNode?: () => void;
  onQuickAddAiNode?: (nodeType: "ai-text" | "ai-image" | "ai-video" | "ai-audio") => void;
  onAction?: (e: React.MouseEvent) => void;
  workflowStatus?: WorkflowExecutionStatus;
  workflowErrorMessage?: string;
  onToggleSidebar?: (e: React.MouseEvent) => void;
  isSidebarVisible?: boolean;
  showControls?: boolean;
  isValidConnection?: IsValidConnection<ReactFlowEdge<WorkflowEdgeType>>;
  disabled?: boolean;
  onFitToScreen?: (e: React.MouseEvent) => void;
  onZoomOneToOne?: (e: React.MouseEvent) => void;
  selectedNodes: ReactFlowNode<WorkflowNodeType>[];
  selectedEdges: ReactFlowEdge<WorkflowEdgeType>[];
  onDeleteSelected?: (e: React.MouseEvent) => void;
  onDuplicateSelected?: (e: React.MouseEvent) => void;
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
  isViewportMoving?: boolean;
  addNodeMenu?: WorkflowAddNodeMenuState | null;
  onAddNodeMenuSelect?: (
    nodeType: "ai-text" | "ai-image" | "ai-video" | "ai-audio",
    menu: WorkflowAddNodeMenuState
  ) => void;
  onCloseAddNodeMenu?: () => void;
  onPaneClick?: () => void;
  onPaneContextMenu?: (event: React.MouseEvent) => void;
}

interface ActionButtonProps {
  onClick: (e: React.MouseEvent) => void;
  workflowStatus?: WorkflowExecutionStatus;
  disabled?: boolean;
  className?: string;
  text?: string;
  showTooltip?: boolean;
}

export function ActionButton({
  onClick,
  workflowStatus = "idle",
  disabled,
  className = "",
  text = "",
  showTooltip = true,
}: ActionButtonProps) {
  const { t } = useTranslation();
  const modifierSymbol = getModifierSymbol();
  const shortcut = `${modifierSymbol}⏎`;

  const statusConfig = {
    idle: {
      icon: <Play className="size-4!" />,
      titleKey: "workflow.canvas.execute" as TranslationKey,
      className:
        "bg-white hover:bg-neutral-50 text-green-500 hover:text-green-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-green-400 dark:hover:text-green-300",
    },
    submitted: {
      icon: <Square className="size-4!" />,
      titleKey: "workflow.canvas.stopExecution" as TranslationKey,
      className:
        "bg-white hover:bg-neutral-50 text-red-500 hover:text-red-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-red-400 dark:hover:text-red-300",
    },
    executing: {
      icon: <Square className="size-4!" />,
      titleKey: "workflow.canvas.stopExecution" as TranslationKey,
      className:
        "bg-white hover:bg-neutral-50 text-red-500 hover:text-red-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-red-400 dark:hover:text-red-300",
    },
    completed: {
      icon: <X className="size-4!" />,
      titleKey: "workflow.canvas.clearOutputs" as TranslationKey,
      className:
        "bg-white hover:bg-neutral-50 text-amber-500 hover:text-amber-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-amber-400 dark:hover:text-amber-300",
    },
    error: {
      icon: <X className="size-4!" />,
      titleKey: "workflow.canvas.clearErrors" as TranslationKey,
      className:
        "bg-white hover:bg-neutral-50 text-amber-500 hover:text-amber-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-amber-400 dark:hover:text-amber-300",
    },
    cancelled: {
      icon: <X className="size-4!" />,
      titleKey: "workflow.canvas.clearOutputs" as TranslationKey,
      className:
        "bg-white hover:bg-neutral-50 text-amber-500 hover:text-amber-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-amber-400 dark:hover:text-amber-300",
    },
    paused: {
      icon: <Play className="size-4!" />,
      titleKey: "workflow.canvas.resume" as TranslationKey,
      className:
        "bg-white hover:bg-neutral-50 text-sky-500 hover:text-sky-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-sky-400 dark:hover:text-sky-300",
    },
  };

  // Use a default config if the status isn't in our mapping
  const config = statusConfig[workflowStatus] || statusConfig.idle;

  return (
    <ActionBarButton
      onClick={onClick}
      disabled={disabled}
      className={cn(config.className, className)}
      tooltipSide="bottom"
      tooltip={
        showTooltip && (
          <div className="flex items-center gap-2">
            <span>{t(config.titleKey)}</span>
            <div className="flex items-center gap-1">
              {shortcut.split("").map((key, index) => (
                <kbd
                  key={index}
                  className="px-1 py-0.25 text-xs rounded border font-mono"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        )
      }
    >
      {config.icon}
      {text}
    </ActionBarButton>
  );
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
              Del
            </kbd>
          </div>
        </div>
      }
    >
      <Trash2 className="size-4!" />
    </ActionBarButton>
  );
}

function DuplicateButton({
  onClick,
  disabled,
}: {
  onClick: (e: React.MouseEvent) => void;
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
          <span>{t("workflow.canvas.duplicate")}</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.25 text-xs rounded border font-mono">
              {modifierKey}
            </kbd>
            <kbd className="px-1 py-0.25 text-xs rounded border font-mono">
              D
            </kbd>
          </div>
        </div>
      }
    >
      <Layers2 className="size-4!" />
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

function AddNodeButton({
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
      tooltip={t("workflow.canvas.addNode")}
      className={cn(
        actionBarButtonOutlineClassName,
        "size-10 p-0! text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
      )}
      tooltipSide="top"
    >
      <Plus className="size-5!" />
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

export function SetScheduleButton({
  onClick,
  disabled,
  className = "",
  text = "",
  tooltip,
}: {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  className?: string;
  text?: string;
  tooltip?: string;
}) {
  const { t } = useTranslation();

  return (
    <ActionBarButton
      onClick={onClick}
      disabled={disabled}
      className={cn(actionBarButtonOutlineClassName, className)}
      tooltipSide="bottom"
      tooltip={tooltip ?? t("workflow.canvas.setSchedule")}
    >
      <Clock className="size-4!" />
      {text}
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
  onAddNode,
  onQuickAddAiNode,
  onAction,
  workflowStatus = "idle",
  workflowErrorMessage,
  onToggleSidebar,
  isSidebarVisible,
  showControls = true,
  isValidConnection,
  disabled = false,
  onFitToScreen,
  onZoomOneToOne,
  selectedNodes,
  selectedEdges,
  onDeleteSelected,
  onDuplicateSelected,
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
  isViewportMoving = false,
  addNodeMenu = null,
  onAddNodeMenuSelect,
  onCloseAddNodeMenu,
  onPaneClick,
  onPaneContextMenu,
}: WorkflowCanvasProps) {
  const { t } = useTranslation();
  const { zoom } = useViewport();
  const [displayNodes, setDisplayNodes] =
    useState<ReactFlowNode<WorkflowNodeType>[]>(nodes);

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
      const nextMoving = isHost && isViewportMoving;

      return {
        ...node,
        data: {
          ...node.data,
          connectedHandleKeys: handleKeys,
          showBottomPanelHost: isHost,
          ...(isHost
            ? { viewportZoom: zoom, isViewportMoving: nextMoving }
            : { viewportZoom: undefined, isViewportMoving: undefined }),
        },
      };
    });
  }, [
    connectedKeysByNode,
    displayNodes,
    nodes,
    isDraggingRef,
    isViewportMoving,
    soleSelectedNodeId,
    zoom,
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
      <div className="h-full w-full min-h-0">
        <ReactFlow
        nodes={renderNodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onNodeDoubleClick={onNodeDoubleClick}
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
          showBackground && "bg-neutral-100/50",
          disabled && "cursor-default",
          addNodeMenu && "cursor-default"
        )}
        nodesDraggable={!disabled && showControls}
        nodesConnectable={!disabled && showControls}
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
        {onEditorViewportChange && (
          <WorkflowViewportPersistenceListener
            disabled={disabled}
            onViewportChange={onEditorViewportChange}
            onViewportGestureEnd={onEditorViewportGestureEnd}
            suppressNextEndRef={suppressViewportPersistEndRef}
          />
        )}
        {showControls && (
          <Controls
            showInteractive={false}
            showZoom={false}
            showFitView={false}
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

        {/* Status Bar - hidden in read-only mode */}
        {!disabled && (
          <StatusBar
            workflowStatus={workflowStatus}
            errorMessage={workflowErrorMessage}
          />
        )}

        {!disabled && (
          <AiEditorOverlays nodes={displayNodes} />
        )}

        {/* Action Bars */}
        {showControls &&
          (onAction || (onToggleSidebar && isSidebarVisible !== undefined)) && (
            <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
              {/* Runtime Actions Group - Execute */}
              {onAction && (
                <ActionBarGroup>
                  <ActionButton
                    onClick={onAction}
                    workflowStatus={workflowStatus}
                    disabled={
                      disabled ||
                      ((workflowStatus === "idle" ||
                        workflowStatus === "submitted" ||
                        workflowStatus === "executing") &&
                        nodes.length === 0)
                    }
                  />
                </ActionBarGroup>
              )}

              {/* View Controls Group - Sidebar */}
              {onToggleSidebar && isSidebarVisible !== undefined && (
                <ActionBarGroup>
                  <SidebarToggle
                    onClick={onToggleSidebar}
                    isSidebarVisible={isSidebarVisible}
                  />
                </ActionBarGroup>
              )}
            </div>
          )}

        {showControls && (
          <Panel
            position="bottom-center"
            className="m-4 flex flex-row items-center gap-2"
          >
            <ActionBarGroup>
              {onAddNode && <AddNodeButton onClick={onAddNode} disabled={disabled} />}
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
              {onDuplicateSelected && (
                <DuplicateButton onClick={onDuplicateSelected} disabled={disabled || !hasSelectedNodes} />
              )}
              {onDeleteSelected && (
                <DeleteButton onClick={onDeleteSelected} disabled={disabled || !hasSelectedElements} />
              )}
            </ActionBarGroup>

            {!disabled && (onApplyLayout || onFitToScreen || onZoomOneToOne) && (
              <ActionBarGroup>
                {onApplyLayout && (
                  <ApplyLayoutButton onClick={() => onApplyLayout()} disabled={disabled || nodes.length === 0} />
                )}
                {onFitToScreen && <FitToScreenButton onClick={onFitToScreen} />}
                {onZoomOneToOne && (
                  <ZoomOneToOneButton onClick={onZoomOneToOne} />
                )}
              </ActionBarGroup>
            )}
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
