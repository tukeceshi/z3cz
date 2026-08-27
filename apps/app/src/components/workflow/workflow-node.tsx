import type { ObjectReference } from "@dafthunk/types";
import { AI_AUDIO_NODE_TYPE, AI_GENERATIVE_NODE_TYPES, AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, AI_VIDEO_NODE_TYPE, readNodeLayoutFromMetadata } from "@dafthunk/types";
import { Handle, Position, useViewport } from "@xyflow/react";
import { AsteriskIcon } from "lucide-react";
// @ts-ignore - https://github.com/lucide-icons/lucide/issues/2867#issuecomment-2847105863
import { DynamicIcon } from "lucide-react/dynamic.mjs";
import BracesIcon from "lucide-react/icons/braces";
import CalendarIcon from "lucide-react/icons/calendar";
import CheckIcon from "lucide-react/icons/check";
import DatabaseIcon from "lucide-react/icons/database";
import FileIcon from "lucide-react/icons/file";
import FileTextIcon from "lucide-react/icons/file-text";
import FolderSearchIcon from "lucide-react/icons/folder-search";
import GlobeIcon from "lucide-react/icons/globe";
import HashIcon from "lucide-react/icons/hash";
import ImageIcon from "lucide-react/icons/image";
import LayersIcon from "lucide-react/icons/layers";
import LinkIcon from "lucide-react/icons/link";
import LockIcon from "lucide-react/icons/lock";
import MusicIcon from "lucide-react/icons/music";
import TablePropertiesIcon from "lucide-react/icons/table-properties";
import TypeIcon from "lucide-react/icons/type";
import VideoIcon from "lucide-react/icons/video";
import { createElement, memo, useMemo, useState } from "react";
import { useParams } from "react-router";

import { useTranslation } from "@/components/locale-provider";
import { useAuth } from "@/components/auth-context";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/utils/utils";
import {
  AI_TEXT_CARD_WIDTH_PX,
  AI_TEXT_CARD_HEIGHT_PX,
  isAiTextGenerating,
} from "./ai-text-node-utils";
import { commitAiTextValue } from "./commit-ai-text-value";
import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";
import {
  AI_AUDIO_CARD_WIDTH_PX,
  AI_AUDIO_CARD_HEIGHT_PX,
  isAiAudioGenerating,
} from "./ai-audio-node-utils";
import {
  readAiImageCardDisplay,
} from "./ai-image-node-utils";
import {
  readAiVideoCardDisplay,
} from "./ai-video-node-utils";
import { readGenerativeCardError } from "./generative-card-error-utils";
import { GenerativeNodeTopToolbar } from "./generative-node-top-toolbar";
import { isWorkflowBottomPanelVisible } from "./ai-generative-panel-utils";
import { shouldShowGenerativeBottomPanel, isGenerativeManualContent } from "./generative-card-mode-utils";
import {
  GENERATIVE_NODE_CARD_CLASS,
  GENERATIVE_NODE_CARD_RADIUS_CLASS,
} from "./generative-card-styles";
import {
  readGenerativeProgressPhase,
} from "./generative-progress-utils";
import { GenerativeCloudJobResumeHost } from "./generative-cloud-job-resume-host";
import { WorkflowNodeGenerativeBusyOverlay } from "./generative-busy-overlay";
import {
  WORKFLOW_NODE_BOTTOM_PANEL_GATE_CLASS,
  WORKFLOW_NODE_TOP_TOOLBAR_GATE_CLASS,
  WORKFLOW_NODE_CARD_INTERACT_CLASS,
  WORKFLOW_NODE_HANDLE_SELECTED_BORDER_CLASS,
  WORKFLOW_NODE_SELECTED_BORDER_CLASS,
} from "./workflow-canvas-styles";
import { GenerativeConnectionSides } from "./generative-edge-connection-side";
import { useGenerativeConnectionHighlight } from "./generative-connection-highlight";
import { PropertyField } from "./fields";
import { Field } from "./fields/field";
import { SubscriptionBadge } from "./subscription-badge";
import { registry } from "./widgets";
import {
  clearNodeInput,
  convertValueByType,
  isWorkflowHandleConnected,
  updateNodeInput,
  useWorkflowActions,
  useWorkflowGraph,
} from "./workflow-context";
import { WorkflowNodeBottomPanel } from "./workflow-node-bottom-panel";
import { useWorkflowNodeBottomPanelData } from "./workflow-node-canvas-ui";
import {
  InputOutputType,
  NodeExecutionState,
  WorkflowParameter,
  type WorkflowNodeType as CanvasWorkflowNodeType,
} from "./workflow-types";

export interface WorkflowNodeType {
  name: string;
  inputs: WorkflowParameter[];
  outputs: WorkflowParameter[];
  error?: string | null;
  executionState: NodeExecutionState;
  nodeType?: string;
  icon: string;
  functionCalling?: boolean;
  asTool?: boolean;
  /** Editor-/runtime-internal flags that round-trip through save/load. */
  metadata?: Record<string, string>;
  createObjectUrl: (objectReference: ObjectReference) => string;
}

export const TypeBadge = memo(
  ({
    type,
    position,
    id,
    nodeId: _nodeId,
    parameter,
    onInputClick,
    onOutputClick,
    disabled,
    className,
    executionState = "idle",
    selected = false,
    isConnected = false,
  }: {
    type: InputOutputType;
    position: Position;
    id: string;
    nodeId: string;
    parameter?: WorkflowParameter;
    onInputClick?: (param: WorkflowParameter, element: HTMLElement) => void;
    onOutputClick?: (param: WorkflowParameter, element: HTMLElement) => void;
    disabled?: boolean;
    className?: string;
    executionState?: NodeExecutionState;
    selected?: boolean;
    isConnected?: boolean;
  }) => {
  const iconSize = "size-2.5!";

  const icon: Partial<Record<InputOutputType, React.ReactNode>> = {
    string: <TypeIcon className={iconSize} />,
    number: <HashIcon className={iconSize} />,
    boolean: <CheckIcon className={iconSize} />,
    blob: <FileIcon className={iconSize} />,
    image: <ImageIcon className={iconSize} />,
    document: <FileTextIcon className={iconSize} />,
    audio: <MusicIcon className={iconSize} />,
    video: <VideoIcon className={iconSize} />,
    json: <BracesIcon className={iconSize} />,
    date: <CalendarIcon className={iconSize} />,
    geojson: <GlobeIcon className={iconSize} />,
    secret: <LockIcon className={iconSize} />,
    schema: <TablePropertiesIcon className={iconSize} />,
    database: <DatabaseIcon className={iconSize} />,
    dataset: <FolderSearchIcon className={iconSize} />,
    queue: <LayersIcon className={iconSize} />,
    integration: <LinkIcon className={iconSize} />,
    any: <AsteriskIcon className={iconSize} />,
  };

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (disabled) return;

    if (position === Position.Left && parameter && onInputClick) {
      onInputClick(parameter, e.currentTarget);
    } else if (position === Position.Right && parameter && onOutputClick) {
      onOutputClick(parameter, e.currentTarget);
    }
  };

  // Check if the parameter has a value set
  const hasValue = parameter && parameter.value !== undefined;
  const isActive = hasValue || isConnected;
  // Determine if this is an input parameter
  const isInput = position === Position.Left;

  // Check if this parameter accepts multiple connections
  const repeated = parameter?.repeated || false;

  // Check if this is a required input with no value and no connection
  const isRequiredAndEmpty =
    isInput && parameter?.required && !hasValue && !isConnected;

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Multiple connections indicator background ring */}
      {repeated && (
        <div
          className={cn(
            "absolute inset-0 rounded-lg border shadow-xs bg-background",
            {
              "border-border": !selected && executionState === "idle",
              "border-yellow-400":
                !selected &&
                (executionState === "executing" ||
                  executionState === "pending"),
              "border-green-500": !selected && executionState === "completed",
              "border-red-500": !selected && executionState === "error",
              "border-blue-400": !selected && executionState === "skipped",
            },
            selected && WORKFLOW_NODE_SELECTED_BORDER_CLASS
          )}
          style={{
            width: "20px",
            height: "20px",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
      <Handle
        type={position === Position.Left ? "target" : "source"}
        position={position}
        id={id}
        className={cn(
          "w-4! h-4! border! rounded-md! inline-flex! items-center! justify-center! p shadow-xs!",
          {
            "bg-neutral-200! dark:bg-neutral-700!": isActive,
            "bg-white! dark:bg-neutral-900!": !isActive,
            "border-border!": !selected && executionState === "idle",
            "border-yellow-400!":
              !selected &&
              (executionState === "executing" || executionState === "pending"),
            "border-green-500!": !selected && executionState === "completed",
            "border-red-500!": !selected && executionState === "error",
            "border-blue-400!": !selected && executionState === "skipped",
          },
          selected && WORKFLOW_NODE_HANDLE_SELECTED_BORDER_CLASS,
          className
        )}
        isConnectableStart={!disabled}
        isConnectable={!disabled}
        onClick={handleClick}
      >
        <span
          className={cn(
            "inline-flex items-center justify-center text-xs font-medium pointer-events-none",
            {
              "text-red-500 dark:text-red-400": isRequiredAndEmpty,
              "text-neutral-800 dark:text-neutral-300":
                !isRequiredAndEmpty && (isConnected || hasValue),
              "text-neutral-600 dark:text-neutral-400":
                !isRequiredAndEmpty && !isConnected && (!isInput || !hasValue),
            }
          )}
        >
          {icon[type] ?? icon.any}
        </span>
      </Handle>
    </div>
  );
  }
);

TypeBadge.displayName = "TypeBadge";

interface WorkflowNodeBottomPanelHostProps {
  readonly nodeId: string;
  readonly data: CanvasWorkflowNodeType;
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
  readonly contentVisible: boolean;
  readonly isDragging: boolean;
}

/** Reads zoom locally so pan/zoom does not rewrite every node's data. */
function WorkflowNodeBottomPanelHost({
  nodeId,
  data,
  createObjectUrl,
  contentVisible,
  isDragging,
}: WorkflowNodeBottomPanelHostProps) {
  const { zoom } = useViewport();
  const { isViewportMoving } = useWorkflowGraph();
  const hide =
    !contentVisible ||
    isDragging ||
    isViewportMoving ||
    !isWorkflowBottomPanelVisible(zoom);

  return (
    <div
      className={cn(
        WORKFLOW_NODE_BOTTOM_PANEL_GATE_CLASS,
        hide && "invisible pointer-events-none"
      )}
      aria-hidden={hide}
    >
      <WorkflowNodeBottomPanel
        nodeId={nodeId}
        data={data}
        createObjectUrl={createObjectUrl}
      />
    </div>
  );
}

interface WorkflowNodeTopToolbarHostProps {
  readonly nodeId: string;
  readonly data: CanvasWorkflowNodeType;
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
  readonly contentVisible: boolean;
  readonly isDragging: boolean;
}

/** Reads zoom locally so pan/zoom does not rewrite every node's data. */
function WorkflowNodeTopToolbarHost({
  nodeId,
  data,
  createObjectUrl,
  contentVisible,
  isDragging,
}: WorkflowNodeTopToolbarHostProps) {
  const { zoom } = useViewport();
  const { isViewportMoving } = useWorkflowGraph();
  const hide =
    !contentVisible ||
    isDragging ||
    isViewportMoving ||
    !isWorkflowBottomPanelVisible(zoom);

  return (
    <div
      className={cn(
        WORKFLOW_NODE_TOP_TOOLBAR_GATE_CLASS,
        hide && "invisible pointer-events-none"
      )}
      aria-hidden={hide}
    >
      <GenerativeNodeTopToolbar
        nodeId={nodeId}
        data={data}
        zoom={zoom}
        createObjectUrl={createObjectUrl}
      />
    </div>
  );
}

export const WorkflowNode = memo(
  ({
    data,
    selected,
    id,
    dragging = false,
  }: {
    data: WorkflowNodeType;
    selected?: boolean;
    id: string;
    dragging?: boolean;
  }) => {
    const {
      updateNodeData,
      disabled,
      nodeTypes,
    } = useWorkflowActions();
    const { t } = useTranslation();
    const { organization } = useAuth();
    const orgId = organization?.id;
    const { id: workflowId } = useParams<{ id: string }>();
    const { configured: cloudConfigured } = useCloudStorageCanvasContext();
    const connectedHandleKeys =
      (data.connectedHandleKeys as readonly string[] | undefined) ?? [];
    const showBottomPanelHost = data.showBottomPanelHost === true;
    const isDragging = dragging;
    const [activeInputId, setActiveInputId] = useState<string | null>(null);
    const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
    const [emptyTextEditing, setEmptyTextEditing] = useState(false);

    const nodeType = data.nodeType || "";
    const isAiTextNode = nodeType === AI_TEXT_NODE_TYPE;
    const isAiImageNode = nodeType === AI_IMAGE_NODE_TYPE;
    const isAiVideoNode = nodeType === AI_VIDEO_NODE_TYPE;
    const isAiAudioNode = nodeType === AI_AUDIO_NODE_TYPE;
    const generativeEdgeModality = isAiTextNode
      ? "text"
      : isAiImageNode
        ? "image"
        : isAiVideoNode
          ? "video"
          : isAiAudioNode
            ? "audio"
            : null;
    const isGenerativeCanvasNode =
      isAiTextNode || isAiImageNode || isAiVideoNode || isAiAudioNode;
    const persistedLayout = useMemo(
      () => readNodeLayoutFromMetadata(data.metadata),
      [data.metadata]
    );
    const showBottomPanelContent =
      (!isAiTextNode && !isAiImageNode && !isAiVideoNode && !isAiAudioNode
        ? true
        : shouldShowGenerativeBottomPanel(data.metadata)) &&
      !(isAiTextNode && emptyTextEditing);
    const bottomPanelData = useWorkflowNodeBottomPanelData(
      data as unknown as CanvasWorkflowNodeType
    );
    const isGenerativeConnectionTarget = useGenerativeConnectionHighlight(
      id,
      isAiTextNode || isAiImageNode || isAiVideoNode || isAiAudioNode
    );

    const resolvedNodeType = useMemo(() => {
      if (!nodeTypes || nodeTypes.length === 0) return null;
      let template = nodeType
        ? nodeTypes.find((t) => t.type === nodeType)
        : undefined;
      if (!template) {
        template = nodeTypes.find((t) => t.name === data.name);
      }
      if (!template) return null;

      return {
        ...template,
        inputs: data.inputs ?? template.inputs,
        outputs: data.outputs ?? template.outputs,
      };
    }, [nodeTypes, nodeType, data.name, data.inputs, data.outputs]);

    const widget = useMemo(
      () =>
        nodeType
          ? registry.for(nodeType, id, data.inputs, data.outputs, data.metadata)
          : null,
      [nodeType, id, data.inputs, data.outputs, data.metadata]
    );

    const handleWidgetChange = (value: string) => {
      if (disabled || !updateNodeData || !widget) return;

      if (nodeType === AI_TEXT_NODE_TYPE) {
        if (!orgId || !workflowId) return;
        void commitAiTextValue({
          organizationId: orgId,
          workflowId,
          cloudConfigured,
          nodeId: id,
          value,
          updateNodeData,
          current: data,
        });
        return;
      }

      const input = data.inputs.find((i) => i.id === widget.inputField);
      if (input) {
        updateNodeInput(id, input.id, value, data.inputs, updateNodeData);
      }
    };

    const resourceInputs = useMemo(() => {
      const resourceTypes = new Set([
        "database",
        "dataset",
        "queue",
        "schema",
        "integration",
      ]);
      return data.inputs.filter(
        (input) =>
          resourceTypes.has(input.type) && !widget?.managedFields?.has(input.id)
      );
    }, [data.inputs, widget]);

    const handleInputClick = (
      param: WorkflowParameter,
      _element: HTMLElement
    ) => {
      if (disabled) return;
      const isConnected = isWorkflowHandleConnected(
        connectedHandleKeys,
        id,
        param.id
      );
      if (isConnected) return;
      // Open dialog for this input
      setActiveInputId(param.id);
    };

    const handleOutputClick = (
      param: WorkflowParameter,
      _element: HTMLElement
    ) => {
      // Only show preview if there's a value
      if (param.value === undefined) return;
      // Open dialog for this output
      setActiveOutputId(param.id);
    };

    const isAiGenerative = (AI_GENERATIVE_NODE_TYPES as readonly string[]).includes(nodeType);
    const isExecuting =
      data.executionState === "executing" ||
      data.executionState === "pending";
    const progressPhase = readGenerativeProgressPhase(data.metadata);
    const aiImageCardDisplay = isAiImageNode
      ? readAiImageCardDisplay(data.inputs, data.outputs, data.metadata)
      : null;
    const aiVideoCardDisplay = isAiVideoNode
      ? readAiVideoCardDisplay(data.inputs, data.outputs, data.metadata)
      : null;
    const generativeCardPhase =
      aiImageCardDisplay?.cardPhase ?? aiVideoCardDisplay?.cardPhase ?? null;
    const isAiTextBusy = isAiTextNode && isAiTextGenerating(data.metadata);
    const isAiImageBusy = isAiImageNode && (aiImageCardDisplay?.isBusy ?? false);
    const isAiVideoBusy = isAiVideoNode && (aiVideoCardDisplay?.isBusy ?? false);
    const isAiAudioBusy =
      isAiAudioNode &&
      (isAiAudioGenerating(data.metadata) || progressPhase !== undefined);
    const generativeCardError =
      isAiTextNode || isAiImageNode || isAiVideoNode || isAiAudioNode
        ? readGenerativeCardError(data.metadata)
        : undefined;
    const showTopToolbarContent =
      isGenerativeCanvasNode && !generativeCardError;
    const showBusyOverlay =
      isExecuting || isAiImageBusy || isAiVideoBusy || isAiAudioBusy;
    const showProgressOverlay = showBusyOverlay;
    const isError =
      (data.executionState === "error" && !!data.error) ||
      Boolean(generativeCardError);

    const nodeDisplayName = data.name;

    const headerIconName =
      isAiAudioNode && data.icon === "audio" ? "music" : data.icon;

    return (
      <TooltipProvider>
        <div className={cn("relative", WORKFLOW_NODE_CARD_INTERACT_CLASS)}>
        <div className={cn("relative", (isAiTextNode || isAiImageNode || isAiVideoNode || isAiAudioNode) && "inline-block")}>
        <div
          className={cn(
            "absolute left-0 z-10",
            isGenerativeCanvasNode && showBottomPanelHost
              ? "bottom-full mb-1"
              : "-top-5"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-1 px-1 py-0.5 rounded-sm",
              "bg-card/40 backdrop-blur-sm"
            )}
          >
            <DynamicIcon
              name={headerIconName as any}
              className={cn(
                "h-2.5 w-2.5 shrink-0 text-muted-foreground/70",
                resolvedNodeType?.trigger || resolvedNodeType?.responder
                  ? "text-emerald-500/70"
                  : "text-blue-500/70"
              )}
            />
            <span className="text-[10px] font-medium text-muted-foreground/70 truncate max-w-[140px]">
              {nodeDisplayName}
            </span>
            {resolvedNodeType?.subscription && (
              <SubscriptionBadge variant="muted" size="sm" />
            )}
          </div>
        </div>

        {isGenerativeCanvasNode && showBottomPanelHost && showTopToolbarContent ? (
          <div className="absolute left-1/2 z-10 -translate-x-1/2 bottom-full mb-7">
            <WorkflowNodeTopToolbarHost
              nodeId={id}
              data={data as unknown as CanvasWorkflowNodeType}
              createObjectUrl={data.createObjectUrl}
              contentVisible={showTopToolbarContent}
              isDragging={isDragging}
            />
          </div>
        ) : null}

        <div
          className={cn(
            "bg-card shadow-xs border relative",
            isGenerativeCanvasNode
              ? GENERATIVE_NODE_CARD_CLASS
              : "rounded-md",
            isAiTextNode && "ai-text-node-card group/aitext flex flex-col",
            isAiImageNode && "ai-image-node-card group/aiimage",
            isAiVideoNode && "ai-video-node-card group/aivideo",
            isAiAudioNode && "ai-audio-node-card group/aiaudio",
            {
            "w-[220px]": !isAiGenerative && !isAiTextNode && !isAiImageNode && !isAiVideoNode && !isAiAudioNode,
            "w-[280px]": isAiGenerative && !isAiTextNode && !isAiImageNode && !isAiVideoNode && !isAiAudioNode,
            "border-border": !selected && data.executionState === "idle" && !isAiTextBusy && !isAiImageBusy && !isAiVideoBusy && !isAiAudioBusy,
            "border-yellow-400":
              !selected && (isExecuting || isAiTextBusy || isAiImageBusy || isAiVideoBusy || isAiAudioBusy),
            "border-green-500":
              !selected && data.executionState === "completed" && !isAiTextBusy && !isAiImageBusy && !isAiVideoBusy && !isAiAudioBusy,
            "border-red-500": !selected && isError,
            "border-blue-400": !selected && data.executionState === "skipped",
          },
          selected && WORKFLOW_NODE_SELECTED_BORDER_CLASS,
          {
            "generative-connect-target": isGenerativeConnectionTarget,
          }
          )}
          style={
            isAiTextNode
              ? {
                  width: persistedLayout?.width ?? AI_TEXT_CARD_WIDTH_PX,
                  height: persistedLayout?.height ?? AI_TEXT_CARD_HEIGHT_PX,
                  boxSizing: "border-box",
                }
              : isAiAudioNode
                ? {
                    width: persistedLayout?.width ?? AI_AUDIO_CARD_WIDTH_PX,
                    height: persistedLayout?.height ?? AI_AUDIO_CARD_HEIGHT_PX,
                  }
                : undefined
          }
        >
          {/* Execution / generate overlay */}
          <WorkflowNodeGenerativeBusyOverlay
            visible={showProgressOverlay}
            isAiImageNode={isAiImageNode}
            isAiVideoNode={isAiVideoNode}
            isAiAudioNode={isAiAudioNode}
            isAiImageBusy={isAiImageBusy}
            isAiVideoBusy={isAiVideoBusy}
            isAiAudioBusy={isAiAudioBusy}
            metadata={data.metadata}
            nodeId={id}
            cardPhase={generativeCardPhase}
            roundedClass={
              isGenerativeCanvasNode
                ? GENERATIVE_NODE_CARD_RADIUS_CLASS
                : "rounded-md"
            }
          />

          {(isAiImageNode || isAiVideoNode || isAiAudioNode) && !disabled ? (
            <GenerativeCloudJobResumeHost
              nodeId={id}
              modality={
                isAiImageNode ? "image" : isAiVideoNode ? "video" : "audio"
              }
              data={data as unknown as CanvasWorkflowNodeType}
            />
          ) : null}

          {/* Error overlay — generative nodes render errors inside their widgets */}
          {isError && data.error && !isAiTextNode && !isAiImageNode && !isAiVideoNode && !isAiAudioNode ? (
            <div className="absolute inset-0 z-10 flex items-start justify-start rounded-md bg-red-500/10 p-2">
              <p className="text-[10px] text-red-600 dark:text-red-400 line-clamp-3">
                {data.error}
              </p>
            </div>
          ) : null}

          {/* Widget — AI text keeps the whole card draggable; only controls use nodrag */}
          {widget && (
            <div
              className={cn(
                "px-0 py-0",
                isAiTextNode && "flex-1 min-h-0 overflow-hidden border-b",
                (isAiImageNode || isAiVideoNode || isAiAudioNode) &&
                  cn("overflow-hidden", GENERATIVE_NODE_CARD_RADIUS_CLASS),
                !isAiTextNode &&
                  !isAiImageNode &&
                  !isAiVideoNode &&
                  !isAiAudioNode &&
                  "border-b",
                !isAiTextNode && !isAiImageNode && !isAiVideoNode && !isAiAudioNode && "nodrag"
              )}
            >
              {createElement(widget.Component, {
                ...widget.config,
                onChange: !disabled ? handleWidgetChange : () => {},
                disabled,
                createObjectUrl: data.createObjectUrl,
                ...(isAiTextNode
                  ? {
                      selected: selected ?? false,
                      onEmptyOutputEditingChange: setEmptyTextEditing,
                    }
                  : {}),
              })}
            </div>
          )}

          {/* Resource Selectors (database, dataset, queue, email, integration) */}
          {resourceInputs.length > 0 && (
            <div className="px-2 py-2 nodrag border-b space-y-1 [&_button]:text-xs [&_button]:h-7">
              {resourceInputs.map((input) => {
                const isConnected = isWorkflowHandleConnected(
                  connectedHandleKeys,
                  id,
                  input.id
                );
                return (
                  <Field
                    key={input.id}
                    parameter={input}
                    value={input.value}
                    onChange={(value) => {
                      if (disabled || !updateNodeData) return;
                      updateNodeInput(
                        id,
                        input.id,
                        value,
                        data.inputs,
                        updateNodeData
                      );
                    }}
                    onClear={() => {
                      if (disabled || !updateNodeData) return;
                      clearNodeInput(id, input.id, data.inputs, updateNodeData);
                    }}
                    disabled={disabled}
                    connected={isConnected}
                  />
                );
              })}
            </div>
          )}

          {/* Parameters — hidden on generative canvas cards (config lives in bottom panel). */}
          {(!isAiTextNode && !isAiImageNode && !isAiVideoNode && !isAiAudioNode) ? (
          <div className="py-2 grid grid-cols-2 justify-between gap-3">
            {/* Input Parameters */}
            <div className="flex flex-col gap-1 flex-1">
              {data.inputs
                .filter((input) => !input.hidden)
                .map((input, index) => (
                  <div
                    key={`input-${input.id}-${index}`}
                    className="flex items-center gap-3 text-xs relative"
                  >
                    <TypeBadge
                      type={input.type}
                      position={Position.Left}
                      id={input.id}
                      nodeId={id}
                      parameter={input}
                      onInputClick={handleInputClick}
                      disabled={disabled}
                      executionState={data.executionState}
                      selected={selected}
                      isConnected={isWorkflowHandleConnected(
                        connectedHandleKeys,
                        id,
                        input.id
                      )}
                    />
                    <span className="text-xs text-foreground font-medium font-mono truncate">
                      {input.name}
                    </span>
                  </div>
                ))}
            </div>

            {/* Output Parameters */}
            <div className="flex flex-col gap-1 flex-1 items-end">
              {data.outputs
                .filter((output) => !output.hidden)
                .map((output, index) => (
                  <div
                    key={`output-${output.id}-${index}`}
                    className="flex items-center gap-3 text-xs relative"
                  >
                    <span className="text-xs text-foreground font-medium font-mono truncate">
                      {output.name}
                    </span>
                    <TypeBadge
                      type={output.type}
                      position={Position.Right}
                      id={output.id}
                      nodeId={id}
                      parameter={output}
                      onOutputClick={handleOutputClick}
                      disabled={disabled}
                      executionState={data.executionState}
                      selected={selected}
                      isConnected={isWorkflowHandleConnected(
                        connectedHandleKeys,
                        id,
                        output.id
                      )}
                    />
                  </div>
                ))}
            </div>
          </div>
          ) : null}
        </div>

        {generativeEdgeModality ? (
          <GenerativeConnectionSides
            modality={generativeEdgeModality}
            disabled={disabled}
            leftDisabled={
              generativeEdgeModality === "audio" &&
              isGenerativeManualContent(data.metadata)
            }
          />
        ) : null}

        {showBottomPanelHost ? (
          <WorkflowNodeBottomPanelHost
            nodeId={id}
            data={bottomPanelData}
            createObjectUrl={data.createObjectUrl}
            contentVisible={showBottomPanelContent}
            isDragging={isDragging}
          />
        ) : null}
        </div>

        {activeInputId !== null ? (
        <Dialog
          open={activeInputId !== null}
          onOpenChange={(open) => !open && setActiveInputId(null)}
        >
          <DialogContent
            className="sm:max-w-md pt-4"
            aria-describedby={undefined}
          >
            <DialogTitle className="sr-only">
              {data.inputs.find((i) => i.id === activeInputId)?.name ||
                t("workflow.node.editInput")}
            </DialogTitle>
            {(() => {
              const activeInput = data.inputs.find(
                (i) => i.id === activeInputId
              );
              if (!activeInput) return null;

              const isInputConnected = isWorkflowHandleConnected(
                connectedHandleKeys,
                id,
                activeInput.id
              );

              return (
                <PropertyField
                  parameter={activeInput}
                  value={activeInput.value}
                  onChange={(value) => {
                    const typedValue = convertValueByType(
                      value as string,
                      activeInput.type || "string"
                    );
                    updateNodeInput(
                      id,
                      activeInput.id,
                      typedValue,
                      data.inputs,
                      updateNodeData
                    );
                  }}
                  onClear={() => {
                    clearNodeInput(
                      id,
                      activeInput.id,
                      data.inputs,
                      updateNodeData
                    );
                  }}
                  onToggleVisibility={() => {
                    if (!updateNodeData) return;
                    updateNodeData(id, (currentData) => {
                      const updatedInputs = currentData.inputs.map((input) =>
                        input.id === activeInput.id
                          ? { ...input, hidden: !input.hidden }
                          : input
                      );
                      return { inputs: updatedInputs };
                    });
                  }}
                  disabled={disabled}
                  connected={isInputConnected}
                  createObjectUrl={data.createObjectUrl}
                  autoFocus
                />
              );
            })()}
          </DialogContent>
        </Dialog>
        ) : null}

        {activeOutputId !== null ? (
        <Dialog
          open={activeOutputId !== null}
          onOpenChange={(open) => !open && setActiveOutputId(null)}
        >
          <DialogContent
            className="sm:max-w-md pt-4"
            aria-describedby={undefined}
          >
            <DialogTitle className="sr-only">
              {data.outputs.find((o) => o.id === activeOutputId)?.name ||
                t("workflow.node.viewOutput")}
            </DialogTitle>
            {(() => {
              const activeOutput = data.outputs.find(
                (o) => o.id === activeOutputId
              );
              if (!activeOutput) return null;

              const isOutputConnected = isWorkflowHandleConnected(
                connectedHandleKeys,
                id,
                activeOutput.id
              );

              return (
                <PropertyField
                  parameter={activeOutput}
                  value={activeOutput.value}
                  onChange={() => {}}
                  onClear={() => {}}
                  onToggleVisibility={() => {
                    if (!updateNodeData) return;
                    updateNodeData(id, (currentData) => {
                      const updatedOutputs = currentData.outputs.map(
                        (output) =>
                          output.id === activeOutput.id
                            ? { ...output, hidden: !output.hidden }
                            : output
                      );
                      return { outputs: updatedOutputs };
                    });
                  }}
                  disabled={disabled}
                  connected={isOutputConnected}
                  createObjectUrl={data.createObjectUrl}
                />
              );
            })()}
          </DialogContent>
        </Dialog>
        ) : null}
        </div>
      </TooltipProvider>
    );
  }
);

WorkflowNode.displayName = "WorkflowNode";
