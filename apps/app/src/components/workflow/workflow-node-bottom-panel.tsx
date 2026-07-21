import type { ObjectReference } from "@dafthunk/types";
import { AI_GENERATIVE_NODE_TYPES, AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import { useNodes } from "@xyflow/react";
import ChevronDownIcon from "lucide-react/icons/chevron-down";
import { createElement, useState } from "react";

import { cn } from "@/utils/utils";

import { useTranslation } from "@/components/locale-provider";

import { AiTextConfigPanel } from "./ai-text-config-panel";
import { AiImageConfigPanel } from "./ai-image-config-panel";
import { AiVideoConfigPanel } from "./ai-video-config-panel";
import { AiNodeConfigPanel } from "./ai-node-config-panel";
import { PropertyField } from "./fields";
import { registry } from "./widgets";
import {
  clearNodeInput,
  convertValueByType,
  updateNodeInput,
  useWorkflow,
} from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

export const NODE_BOTTOM_PANEL_SINGLE_WIDTH = 384;
export const NODE_BOTTOM_PANEL_DOUBLE_WIDTH = 768;
export const NODE_BOTTOM_PANEL_HEIGHT = 280;
const TWO_COLUMN_MIN_ITEMS = 4;

export interface WorkflowNodeBottomPanelProps {
  nodeId: string;
  data: WorkflowNodeType;
  createObjectUrl: (objectReference: ObjectReference) => string;
}

export function WorkflowNodeBottomPanel({
  nodeId,
  data,
  createObjectUrl,
}: WorkflowNodeBottomPanelProps) {
  const { t } = useTranslation();
  const {
    updateNodeData,
    edges = [],
    deleteEdge,
    disabled = false,
  } = useWorkflow();
  const nodes = useNodes();
  const [inputsExpanded, setInputsExpanded] = useState(true);
  const [outputsExpanded, setOutputsExpanded] = useState(true);
  const [errorExpanded, setErrorExpanded] = useState(true);

  // AI generative nodes get a dedicated config panel
  if (data.nodeType === AI_TEXT_NODE_TYPE) {
    return <AiTextConfigPanel nodeId={nodeId} data={data} />;
  }

  if (data.nodeType === AI_IMAGE_NODE_TYPE) {
    return <AiImageConfigPanel nodeId={nodeId} data={data} />;
  }

  if (data.nodeType === AI_VIDEO_NODE_TYPE) {
    return <AiVideoConfigPanel nodeId={nodeId} data={data} />;
  }

  if (
    data.nodeType &&
    (AI_GENERATIVE_NODE_TYPES as readonly string[]).includes(data.nodeType)
  ) {
    return <AiNodeConfigPanel nodeId={nodeId} data={data} />;
  }

  const inputs = data.inputs;
  const outputs = data.outputs;

  const isInputConnected = (inputId: string): boolean => {
    return edges.some(
      (edge) => edge.target === nodeId && edge.targetHandle === inputId
    );
  };

  const getConnectedValue = (inputId: string): unknown => {
    const connectedEdge = edges.find(
      (edge) => edge.target === nodeId && edge.targetHandle === inputId
    );
    if (!connectedEdge) return undefined;

    const sourceNode = nodes.find((n) => n.id === connectedEdge.source);
    if (!sourceNode) return undefined;

    const sourceData = sourceNode.data as WorkflowNodeType;
    const output = sourceData.outputs?.find(
      (out) => out.id === connectedEdge.sourceHandle
    );
    return output?.value;
  };

  const handleClearValue = (inputId: string) => {
    if (disabled || !updateNodeData) return;
    clearNodeInput(nodeId, inputId, inputs, updateNodeData);
  };

  const handleToggleVisibility = (inputId: string) => {
    if (disabled || !updateNodeData) return;

    const updatedInputs = inputs.map((input) =>
      input.id === inputId ? { ...input, hidden: !input.hidden } : input
    );

    updateNodeData(nodeId, {
      ...data,
      inputs: updatedInputs,
    });
  };

  const handleToggleOutputVisibility = (outputId: string) => {
    if (disabled || !updateNodeData) return;

    const updatedOutputs = outputs.map((output) =>
      output.id === outputId ? { ...output, hidden: !output.hidden } : output
    );

    updateNodeData(nodeId, {
      ...data,
      outputs: updatedOutputs,
    });
  };

  const handleDisconnect = (inputId: string) => {
    if (disabled || !deleteEdge) return;

    const connectedEdges = edges.filter(
      (edge) => edge.target === nodeId && edge.targetHandle === inputId
    );

    connectedEdges.forEach((edge) => deleteEdge(edge.id));
  };

  const nodeType = data.nodeType;
  const widget = nodeType
    ? registry.for(nodeType, nodeId, inputs, outputs, data.metadata)
    : null;

  const handleWidgetChange = (value: unknown) => {
    if (disabled || !updateNodeData || !widget) return;
    updateNodeInput(nodeId, widget.inputField, value, inputs, updateNodeData);
  };

  const inputFields = inputs.flatMap((input) => {
    if (
      widget &&
      widget.managedFields.has(input.id) &&
      input.id !== widget.inputField
    ) {
      return [];
    }

    if (widget && input.id === widget.inputField) {
      return [
        <div key={input.id} className="min-w-0">
          <PropertyField
            parameter={input}
            value={input.value}
            onChange={() => {}}
            onClear={() => handleClearValue(input.id)}
            onToggleVisibility={() => handleToggleVisibility(input.id)}
            disabled={disabled}
            createObjectUrl={createObjectUrl}
            headerOnly
          />
          <div className="[&_button]:h-9 [&_button]:text-sm [&_select]:h-9 [&_select]:text-sm">
            {createElement(widget.Component, {
              ...widget.config,
              onChange: !disabled ? handleWidgetChange : () => {},
              disabled,
              createObjectUrl,
              className: "p-0",
            })}
          </div>
        </div>,
      ];
    }

    const isConnected = isInputConnected(input.id);
    return [
      <div key={input.id} className="min-w-0">
        <PropertyField
          parameter={input}
          value={isConnected ? getConnectedValue(input.id) : input.value}
          onChange={(value) => {
            const typedValue = convertValueByType(
              value as string,
              input.type || "string"
            );
            updateNodeInput(
              nodeId,
              input.id,
              typedValue,
              inputs,
              updateNodeData
            );
          }}
          onClear={() => handleClearValue(input.id)}
          onDisconnect={() => handleDisconnect(input.id)}
          onToggleVisibility={() => handleToggleVisibility(input.id)}
          disabled={disabled}
          connected={isConnected}
          createObjectUrl={createObjectUrl}
        />
      </div>,
    ];
  });

  const useTwoColumnInputs = inputFields.length >= TWO_COLUMN_MIN_ITEMS;
  const useTwoColumnOutputs = outputs.length >= TWO_COLUMN_MIN_ITEMS;
  const panelWidth =
    useTwoColumnInputs || useTwoColumnOutputs
      ? NODE_BOTTOM_PANEL_DOUBLE_WIDTH
      : NODE_BOTTOM_PANEL_SINGLE_WIDTH;

  return (
    <div
      className={cn(
        "nodrag nopan nowheel absolute top-full left-1/2 z-20 mt-2",
        "-translate-x-1/2 overflow-hidden rounded-md border border-border",
        "bg-neutral-50 shadow-md dark:bg-neutral-800"
      )}
      style={{
        width: panelWidth,
        height: NODE_BOTTOM_PANEL_HEIGHT,
      }}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="h-full overflow-y-auto">
        {data.error ? (
          <div className="border-b border-border">
            <button
              type="button"
              onClick={() => setErrorExpanded(!errorExpanded)}
              className="group flex w-full items-center justify-between px-3 py-2"
            >
              <h2 className="text-sm font-semibold text-foreground">{t("workflow.panel.error")}</h2>
              <ChevronDownIcon
                className={cn(
                  "h-4 w-4 text-neutral-400 dark:text-neutral-500",
                  errorExpanded ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>
            {errorExpanded ? (
              <div className="px-3 pb-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {data.error}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setInputsExpanded(!inputsExpanded)}
            className="group flex w-full items-center justify-between px-3 py-2"
          >
            <h2 className="text-sm font-semibold text-foreground">{t("workflow.panel.inputs")}</h2>
            <ChevronDownIcon
              className={cn(
                "h-4 w-4 text-neutral-400 group-hover:text-neutral-700 dark:text-neutral-500 dark:group-hover:text-neutral-300",
                inputsExpanded ? "rotate-0" : "-rotate-90"
              )}
            />
          </button>
          {inputsExpanded ? (
            <div
              className={cn(
                "gap-3 px-3 pb-3",
                useTwoColumnInputs ? "grid grid-cols-2" : "grid grid-cols-1"
              )}
            >
              {inputFields.length > 0 ? (
                inputFields
              ) : (
                <div className="col-span-2 text-sm text-muted-foreground">
                  {t("workflow.panel.noInputs")}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setOutputsExpanded(!outputsExpanded)}
            className="group flex w-full items-center justify-between px-3 py-2"
          >
            <h2 className="text-sm font-semibold text-foreground">{t("workflow.panel.outputs")}</h2>
            <ChevronDownIcon
              className={cn(
                "h-4 w-4 text-neutral-400 dark:text-neutral-500",
                outputsExpanded ? "rotate-0" : "-rotate-90"
              )}
            />
          </button>
          {outputsExpanded ? (
            <div
              className={cn(
                "gap-3 px-3 pb-3",
                useTwoColumnOutputs ? "grid grid-cols-2" : "grid grid-cols-1"
              )}
            >
              {outputs.length > 0 ? (
                outputs.map((output) => (
                  <div key={output.id} className="min-w-0">
                    <PropertyField
                      parameter={output}
                      value={output.value}
                      onChange={() => {}}
                      onClear={() => {}}
                      onToggleVisibility={() =>
                        handleToggleOutputVisibility(output.id)
                      }
                      disabled
                      createObjectUrl={createObjectUrl}
                    />
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-sm text-muted-foreground">
                  {t("workflow.panel.noOutputs")}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
