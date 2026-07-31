import type { ObjectReference, ToolReference } from "@dafthunk/types";
import { AI_AUDIO_NODE_TYPE, AI_GENERATIVE_NODE_TYPES, AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import { Handle, Position } from "@xyflow/react";
import { AsteriskIcon } from "lucide-react";
// @ts-ignore - https://github.com/lucide-icons/lucide/issues/2867#issuecomment-2847105863
import { DynamicIcon } from "lucide-react/dynamic.mjs";
import BoxIcon from "lucide-react/icons/box";
import BracesIcon from "lucide-react/icons/braces";
import CalendarIcon from "lucide-react/icons/calendar";
import CheckIcon from "lucide-react/icons/check";
import CircleHelp from "lucide-react/icons/circle-help";
import DatabaseIcon from "lucide-react/icons/database";
import FileIcon from "lucide-react/icons/file";
import FileTextIcon from "lucide-react/icons/file-text";
import FolderSearchIcon from "lucide-react/icons/folder-search";
import GlobeIcon from "lucide-react/icons/globe";
import HashIcon from "lucide-react/icons/hash";
import ImageIcon from "lucide-react/icons/image";
import LayersIcon from "lucide-react/icons/layers";
import LinkIcon from "lucide-react/icons/link";
import LoaderIcon from "lucide-react/icons/loader-circle";
import LockIcon from "lucide-react/icons/lock";
import MailIcon from "lucide-react/icons/mail";
import MusicIcon from "lucide-react/icons/music";
import SettingsIcon from "lucide-react/icons/settings";
import TablePropertiesIcon from "lucide-react/icons/table-properties";
import TrashIcon from "lucide-react/icons/trash-2";
import TypeIcon from "lucide-react/icons/type";
import VideoIcon from "lucide-react/icons/video";
import WrenchIcon from "lucide-react/icons/wrench";
import { createElement, memo, useEffect, useMemo, useState } from "react";

import { NodeDocsDialog } from "@/components/docs/node-docs-dialog";
import { useTranslation } from "@/components/locale-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { TranslateFn } from "@/i18n";
import { cn } from "@/utils/utils";
import {
  AI_TEXT_CARD_WIDTH_PX,
  hasAiTextGeneratedHistory,
  isAiTextGenerating,
  withAiTextEditedResult,
  withAiTextManualResult,
} from "./ai-text-node-utils";
import {
  AI_AUDIO_CARD_WIDTH_PX,
  isAiAudioGenerating,
} from "./ai-audio-node-utils";
import {
  isAiVideoGenerating,
} from "./ai-video-node-utils";
import {
  isAiImageGenerating,
} from "./ai-image-node-utils";
import { readGenerativeCardError } from "./generative-card-error-utils";
import { isWorkflowBottomPanelVisible } from "./ai-generative-panel-utils";
import { shouldShowGenerativeBottomPanel, isGenerativeManualContent } from "./generative-card-mode-utils";
import {
  GENERATIVE_NODE_CARD_CLASS,
  GENERATIVE_NODE_CARD_RADIUS_CLASS,
} from "./generative-card-styles";
import {
  formatGenerativeBusyOverlayLabel,
  readGenerativeProgressPhase,
} from "./generative-progress-utils";
import { GenerativeCloudJobResumeHost } from "./generative-cloud-job-resume-host";
import {
  generativeAudioProgressButtonKey,
  generativeProgressButtonKey,
  generativeVideoProgressButtonKey,
} from "@/hooks/use-generative-cloud-job";
import {
  WORKFLOW_NODE_HANDLE_SELECTED_BORDER_CLASS,
  WORKFLOW_NODE_SELECTED_BORDER_CLASS,
} from "./workflow-canvas-styles";
import { AiTextConnectionSides } from "./ai-text-connection-handles";
import { AiImageConnectionSides } from "./ai-image-connection-handles";
import { AiAudioConnectionSides } from "./ai-audio-connection-handles";
import { AiVideoConnectionSides } from "./ai-video-connection-handles";
import { useGenerativeConnectionHighlight } from "./generative-connection-highlight";
import { PropertyField } from "./fields";
import { Field } from "./fields/field";
import { SubscriptionBadge } from "./subscription-badge";
import { ToolConfigPanel } from "./tool-config-panel";
import { registry } from "./widgets";
import {
  CFG_META_KEY,
  CLOUDFLARE_GATEWAY_MODEL_NODE_TYPE,
  decodeCloudflareGatewayModelMeta,
  deriveCloudflareGatewayModelDocs,
} from "./widgets/input/cloudflare-gateway-model-utils";
import {
  CF_META_KEY,
  CLOUDFLARE_MODEL_NODE_TYPE,
  decodeCloudflareModelMeta,
  deriveCloudflareModelDocs,
} from "./widgets/input/cloudflare-model-utils";
import {
  decodeReplicateModelMeta,
  deriveReplicateModelDocs,
  REPLICATE_MODEL_NODE_TYPE,
  RP_META_KEY,
} from "./widgets/input/replicate-model-utils";
import {
  clearNodeInput,
  convertValueByType,
  isWorkflowHandleConnected,
  updateNodeInput,
  useWorkflowActions,
} from "./workflow-context";
import { WorkflowNodeBottomPanel } from "./workflow-node-bottom-panel";
import { WorkflowToolSelector } from "./workflow-tool-selector";
import {
  InputOutputType,
  NodeExecutionState,
  WorkflowParameter,
  type WorkflowNodeType as CanvasWorkflowNodeType,
} from "./workflow-types";

/**
 * Derive docs-dialog overrides for generic node types whose description /
 * documentation / referenceUrl depend on user-selected configuration (e.g.
 * the Cloudflare Model node's selected model id). Returns an empty object
 * for every other node type, leaving the template's static fields in place.
 */
function deriveDocOverridesForNode(
  nodeType: string,
  inputs: WorkflowParameter[],
  metadata: Record<string, string> | undefined,
  t: TranslateFn
): { description?: string; documentation?: string; referenceUrl?: string } {
  if (nodeType === CLOUDFLARE_MODEL_NODE_TYPE) {
    const modelId = inputs.find((i) => i.id === "model")?.value;
    if (typeof modelId !== "string" || !modelId) return {};
    const meta = decodeCloudflareModelMeta(metadata?.[CF_META_KEY]);
    return deriveCloudflareModelDocs(modelId, meta, t);
  }
  if (nodeType === REPLICATE_MODEL_NODE_TYPE) {
    const modelId = inputs.find((i) => i.id === "model")?.value;
    if (typeof modelId !== "string" || !modelId) return {};
    const meta = decodeReplicateModelMeta(metadata?.[RP_META_KEY]);
    return deriveReplicateModelDocs(modelId, meta, t);
  }
  if (nodeType === CLOUDFLARE_GATEWAY_MODEL_NODE_TYPE) {
    const modelId = inputs.find((i) => i.id === "model")?.value;
    if (typeof modelId !== "string" || !modelId) return {};
    const meta = decodeCloudflareGatewayModelMeta(metadata?.[CFG_META_KEY]);
    return deriveCloudflareGatewayModelDocs(modelId, meta, t);
  }
  return {};
}

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

  const icon: Record<InputOutputType, React.ReactNode> = {
    string: <TypeIcon className={iconSize} />,
    number: <HashIcon className={iconSize} />,
    boolean: <CheckIcon className={iconSize} />,
    blob: <FileIcon className={iconSize} />,
    image: <ImageIcon className={iconSize} />,
    document: <FileTextIcon className={iconSize} />,
    audio: <MusicIcon className={iconSize} />,
    video: <VideoIcon className={iconSize} />,
    gltf: <BoxIcon className={iconSize} />,
    buffergeometry: <BoxIcon className={iconSize} />,
    json: <BracesIcon className={iconSize} />,
    date: <CalendarIcon className={iconSize} />,
    geojson: <GlobeIcon className={iconSize} />,
    secret: <LockIcon className={iconSize} />,
    schema: <TablePropertiesIcon className={iconSize} />,
    database: <DatabaseIcon className={iconSize} />,
    dataset: <FolderSearchIcon className={iconSize} />,
    queue: <LayersIcon className={iconSize} />,
    email: <MailIcon className={iconSize} />,
    discord: <LinkIcon className={iconSize} />,
    telegram: <LinkIcon className={iconSize} />,
    whatsapp: <LinkIcon className={iconSize} />,
    slack: <LinkIcon className={iconSize} />,
    integration: <LinkIcon className={iconSize} />,
    any: <AsteriskIcon className={iconSize} />,
  } satisfies Record<InputOutputType, React.ReactNode>;

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
          {icon[type]}
        </span>
      </Handle>
    </div>
  );
  }
);

TypeBadge.displayName = "TypeBadge";

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
      allowedNodeTypes,
    } = useWorkflowActions();
    const { t } = useTranslation();
    const connectedHandleKeys =
      (data.connectedHandleKeys as readonly string[] | undefined) ?? [];
    const showBottomPanelHost = data.showBottomPanelHost === true;
    const viewportZoom =
      typeof data.viewportZoom === "number" ? data.viewportZoom : 1;
    const isViewportMovingCanvas = data.isViewportMoving === true;
    const isDragging = dragging;
    const [isToolSelectorOpen, setIsToolSelectorOpen] = useState(false);
    const [isDocsOpen, setIsDocsOpen] = useState(false);
    const [activeInputId, setActiveInputId] = useState<string | null>(null);
    const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
    const [configToolId, setConfigToolId] = useState<string | null>(null);

    const nodeType = data.nodeType || "";
    const isAiTextNode = nodeType === AI_TEXT_NODE_TYPE;
    const isAiImageNode = nodeType === AI_IMAGE_NODE_TYPE;
    const isAiVideoNode = nodeType === AI_VIDEO_NODE_TYPE;
    const isAiAudioNode = nodeType === AI_AUDIO_NODE_TYPE;
    const isGenerativeCanvasNode =
      isAiTextNode || isAiImageNode || isAiVideoNode || isAiAudioNode;
    const showBottomPanel =
      isWorkflowBottomPanelVisible(viewportZoom) &&
      (!isAiTextNode && !isAiImageNode && !isAiVideoNode && !isAiAudioNode
        ? true
        : shouldShowGenerativeBottomPanel(data.metadata));
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

      const overrides = deriveDocOverridesForNode(
        nodeType,
        data.inputs,
        data.metadata,
        t
      );

      return {
        ...template,
        ...overrides,
        inputs: data.inputs ?? template.inputs,
        outputs: data.outputs ?? template.outputs,
      };
    }, [nodeTypes, nodeType, data.name, data.inputs, data.outputs, data.metadata, t]);

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
        updateNodeData(id, (current) =>
          hasAiTextGeneratedHistory(current.inputs)
            ? withAiTextEditedResult(current, value)
            : withAiTextManualResult(current, value)
        );
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
        "email",
        "integration",
        "discord",
        "telegram",
      ]);
      return data.inputs.filter(
        (input) =>
          resourceTypes.has(input.type) && !widget?.managedFields?.has(input.id)
      );
    }, [data.inputs, widget]);

    const handleToolSelectorClose = () => {
      setIsToolSelectorOpen(false);
    };

    const handleToolsSelect = (tool: ToolReference) => {
      if (disabled || !updateNodeData) return;

      // Use functional updater to always read the latest node data,
      // avoiding stale closure issues with React.memo
      updateNodeData(id, (currentData) => {
        const toolsInput = currentData.inputs.find(
          (input) => input.id === "tools"
        );
        if (!toolsInput) return {};

        const currentTools = Array.isArray(toolsInput.value)
          ? (toolsInput.value as ToolReference[])
          : [];

        if (currentTools.some((t) => t.identifier === tool.identifier)) {
          return {};
        }

        const updatedTools = [...currentTools, tool];
        const updatedInputs = currentData.inputs.map((input) =>
          input.id === "tools"
            ? ({ ...input, value: updatedTools } as WorkflowParameter)
            : input
        );
        return { inputs: updatedInputs };
      });
    };

    const handleRemoveTool = (toolIdentifier: string) => {
      if (disabled || !updateNodeData) return;

      updateNodeData(id, (currentData) => {
        const toolsInput = currentData.inputs.find(
          (input) => input.id === "tools"
        );
        if (!toolsInput) return {};

        const currentTools = Array.isArray(toolsInput.value)
          ? (toolsInput.value as ToolReference[])
          : [];

        const updatedTools = currentTools.filter(
          (t) => t.identifier !== toolIdentifier
        );

        const updatedInputs = currentData.inputs.map((input) =>
          input.id === "tools"
            ? ({ ...input, value: updatedTools } as WorkflowParameter)
            : input
        );
        return { inputs: updatedInputs };
      });
    };

    const handleToolConfigSave = (
      toolIdentifier: string,
      config: Record<string, unknown>
    ) => {
      if (disabled || !updateNodeData) return;

      updateNodeData(id, (currentData) => {
        const toolsInput = currentData.inputs.find(
          (input) => input.id === "tools"
        );
        if (!toolsInput) return {};

        const currentTools = Array.isArray(toolsInput.value)
          ? (toolsInput.value as ToolReference[])
          : [];

        const updatedTools = currentTools.map((t) =>
          t.identifier === toolIdentifier
            ? {
                ...t,
                config: Object.keys(config).length > 0 ? config : undefined,
              }
            : t
        );

        const updatedInputs = currentData.inputs.map((input) =>
          input.id === "tools"
            ? ({ ...input, value: updatedTools } as WorkflowParameter)
            : input
        );
        return { inputs: updatedInputs };
      });
    };

    // Get current selected tools from the tools input
    const getCurrentSelectedTools = (): ToolReference[] => {
      const toolsInput = data.inputs.find((input) => input.id === "tools");
      if (toolsInput && Array.isArray(toolsInput.value)) {
        return toolsInput.value as ToolReference[];
      }
      return [];
    };

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
    const isAiTextBusy = isAiTextNode && isAiTextGenerating(data.metadata);
    const isAiImageBusy =
      isAiImageNode &&
      (isAiImageGenerating(data.metadata) || progressPhase !== undefined);
    const isAiVideoBusy =
      isAiVideoNode &&
      (isAiVideoGenerating(data.metadata) || progressPhase !== undefined);
    const isAiAudioBusy =
      isAiAudioNode &&
      (isAiAudioGenerating(data.metadata) || progressPhase !== undefined);
    const generativeCardError =
      isAiTextNode || isAiImageNode || isAiVideoNode || isAiAudioNode
        ? readGenerativeCardError(data.metadata)
        : undefined;
    const showBusyOverlay =
      isExecuting || isAiImageBusy || isAiVideoBusy || isAiAudioBusy;
    const isError =
      (data.executionState === "error" && !!data.error) ||
      Boolean(generativeCardError);

    const [progressNowMs, setProgressNowMs] = useState(() => Date.now());
    useEffect(() => {
      if (!showBusyOverlay || !progressPhase) {
        return;
      }
      setProgressNowMs(Date.now());
      const timerId = window.setInterval(() => {
        setProgressNowMs(Date.now());
      }, 1000);
      return () => {
        window.clearInterval(timerId);
      };
    }, [progressPhase, showBusyOverlay]);

    const busyOverlayLabel = useMemo(() => {
      if (
        !isAiImageNode &&
        !isAiVideoNode &&
        !isAiAudioNode
      ) {
        return null;
      }
      if (!isAiImageBusy && !isAiVideoBusy && !isAiAudioBusy && !progressPhase) {
        return null;
      }

      const phase = progressPhase ?? "generating";
      if (isAiImageNode) {
        return formatGenerativeBusyOverlayLabel({
          phase,
          progressButtonKey: generativeProgressButtonKey,
          i18nPrefix: "workflow.aiImagePanel",
          metadata: data.metadata,
          progressNowMs,
          t,
        });
      }
      if (isAiVideoNode) {
        return formatGenerativeBusyOverlayLabel({
          phase,
          progressButtonKey: generativeVideoProgressButtonKey,
          i18nPrefix: "workflow.aiVideoPanel",
          metadata: data.metadata,
          progressNowMs,
          t,
        });
      }
      return formatGenerativeBusyOverlayLabel({
        phase,
        progressButtonKey: generativeAudioProgressButtonKey,
        i18nPrefix: "workflow.aiAudioPanel",
        metadata: data.metadata,
        progressNowMs,
        t,
      });
    }, [
      data.metadata,
      isAiAudioBusy,
      isAiAudioNode,
      isAiImageBusy,
      isAiImageNode,
      isAiVideoBusy,
      isAiVideoNode,
      progressNowMs,
      progressPhase,
      t,
    ]);

    const nodeDisplayName = data.name;

    const headerIconName =
      isAiAudioNode && data.icon === "audio" ? "music" : data.icon;

    return (
      <TooltipProvider>
        <div className="relative">
        {/* Floating mini header — icon + name */}
        <div
          className={cn(
            "absolute -top-5 left-0 z-10",
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

        {/* Docs button — absolute top-right, always visible, faded */}
        <button
          type="button"
          className={cn(
            "nodrag absolute -top-5 right-0 z-10 p-0.5 rounded-sm",
            "text-muted-foreground/50 hover:text-muted-foreground",
            "bg-card/40 backdrop-blur-sm"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (!resolvedNodeType) return;
            setIsDocsOpen(true);
          }}
          aria-label={t("workflow.node.openDocsAria")}
          title={
            resolvedNodeType
              ? t("workflow.node.openDocs")
              : t("workflow.node.docsUnavailable")
          }
          disabled={!resolvedNodeType}
        >
          <CircleHelp className="h-2.5 w-2.5" />
        </button>

        <div className={cn("relative", (isAiTextNode || isAiImageNode || isAiVideoNode || isAiAudioNode) && "inline-block")}>
        <div
          className={cn(
            "bg-card shadow-xs border relative",
            isGenerativeCanvasNode
              ? GENERATIVE_NODE_CARD_CLASS
              : "rounded-md",
            isAiTextNode && "ai-text-node-card group/aitext",
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
              ? { width: AI_TEXT_CARD_WIDTH_PX }
              : isAiAudioNode
                ? { width: AI_AUDIO_CARD_WIDTH_PX }
                : undefined
          }
        >
          {/* Execution / generate overlay */}
          {showBusyOverlay && (
            <div
              className={cn(
                "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card/70 backdrop-blur-[1px]",
                isGenerativeCanvasNode
                  ? GENERATIVE_NODE_CARD_RADIUS_CLASS
                  : "rounded-md"
              )}
            >
              <LoaderIcon className="h-5 w-5 text-yellow-500 animate-spin" />
              {busyOverlayLabel ? (
                <p className="max-w-[90%] px-3 text-center text-[11px] leading-snug text-muted-foreground">
                  {busyOverlayLabel}
                </p>
              ) : null}
            </div>
          )}

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
                isAiImageNode || isAiVideoNode || isAiAudioNode
                  ? cn("overflow-hidden", GENERATIVE_NODE_CARD_RADIUS_CLASS)
                  : "border-b",
                !isAiTextNode && !isAiImageNode && !isAiVideoNode && !isAiAudioNode && "nodrag"
              )}
            >
              {createElement(widget.Component, {
                ...widget.config,
                onChange: !disabled ? handleWidgetChange : () => {},
                disabled,
                createObjectUrl: data.createObjectUrl,
              })}
            </div>
          )}

          {isAiTextNode ? (
            <AiTextConnectionSides disabled={disabled} />
          ) : null}

          {isAiImageNode ? (
            <AiImageConnectionSides disabled={disabled} />
          ) : null}

          {isAiVideoNode ? (
            <AiVideoConnectionSides disabled={disabled} />
          ) : null}

          {isAiAudioNode ? (
            <AiAudioConnectionSides
              disabled={disabled}
              promptInputDisabled={isGenerativeManualContent(data.metadata)}
            />
          ) : null}

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

          {/* Tools bar (between header and body) */}
          {data.functionCalling && (
            <div className="px-2 py-2 nodrag border-b space-y-2">
              <button
                type="button"
                className={cn(
                  "w-full px-2 py-1 rounded text-xs font-medium flex items-center justify-center gap-1.5",
                  "border border-border bg-background hover:bg-neutral-100",
                  "dark:hover:bg-neutral-800",
                  {
                    "opacity-50 cursor-not-allowed": disabled,
                  }
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (disabled) return;
                  setIsToolSelectorOpen(true);
                }}
                disabled={disabled}
              >
                <WrenchIcon className="h-3 w-3" />
                Add Tool
              </button>
              {getCurrentSelectedTools().length > 0 && (
                <div className="space-y-1">
                  {[...getCurrentSelectedTools()]
                    .sort((a, b) => {
                      const tplA = nodeTypes?.find(
                        (t) => t.id === a.identifier
                      );
                      const tplB = nodeTypes?.find(
                        (t) => t.id === b.identifier
                      );
                      const nameA = tplA?.name || a.identifier;
                      const nameB = tplB?.name || b.identifier;
                      return nameA.localeCompare(nameB);
                    })
                    .map((tool, idx) => {
                      const tpl = nodeTypes?.find(
                        (t) => t.id === tool.identifier
                      );
                      return (
                        <div
                          key={`${tool.identifier}-${idx}`}
                          className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-neutral-100 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 w-full"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {tpl?.icon && (
                              <DynamicIcon
                                name={tpl.icon as any}
                                className="h-3 w-3 shrink-0"
                              />
                            )}
                            <span className="truncate">
                              {tpl?.name || tool.identifier}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              className={cn(
                                "hover:text-neutral-900 dark:hover:text-neutral-100",
                                tool.config &&
                                  Object.keys(tool.config).length > 0
                                  ? "text-blue-500 dark:text-blue-400"
                                  : "text-neutral-400 dark:text-neutral-500"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfigToolId(tool.identifier);
                              }}
                              disabled={disabled}
                              aria-label={t("workflow.node.configureTool")}
                            >
                              <SettingsIcon className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTool(tool.identifier);
                              }}
                              disabled={disabled}
                              aria-label={t("workflow.node.removeTool")}
                            >
                              <TrashIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
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
        </div>

        {showBottomPanelHost && !isDragging && !isViewportMovingCanvas ? (
          <div
            className={cn(!showBottomPanel && "hidden pointer-events-none")}
            aria-hidden={!showBottomPanel}
          >
            <WorkflowNodeBottomPanel
              nodeId={id}
              data={data as unknown as CanvasWorkflowNodeType}
              createObjectUrl={data.createObjectUrl}
            />
          </div>
        ) : null}

        <WorkflowToolSelector
          open={data.functionCalling ? isToolSelectorOpen : false}
          onClose={handleToolSelectorClose}
          onSelect={handleToolsSelect}
          templates={nodeTypes || []}
        />

        {configToolId
          ? (() => {
            const tool = getCurrentSelectedTools().find(
              (t) => t.identifier === configToolId
            );
            const tpl = nodeTypes?.find((t) => t.id === configToolId);
            if (!tool || !tpl) return null;
            return (
              <ToolConfigPanel
                open={!!configToolId}
                onClose={() => setConfigToolId(null)}
                onSave={(config) => {
                  handleToolConfigSave(configToolId, config);
                  setConfigToolId(null);
                }}
                toolName={tpl.name}
                inputs={tpl.inputs}
                currentConfig={tool.config ?? {}}
              />
            );
          })()
          : null}

        {resolvedNodeType && isDocsOpen ? (
          <NodeDocsDialog
            nodeType={resolvedNodeType}
            isOpen={isDocsOpen}
            onOpenChange={setIsDocsOpen}
          />
        ) : null}

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
