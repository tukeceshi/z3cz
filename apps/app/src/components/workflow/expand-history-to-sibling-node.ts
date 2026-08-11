import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  type MediaReference,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import {
  AI_AUDIO_HISTORY_INPUT_ID,
  AI_AUDIO_OUTPUT_ID,
  AI_AUDIO_RESULT_INPUT_ID,
  mergeAiAudioNodeCatalogInputs,
} from "./ai-audio-node-utils";
import {
  AI_IMAGE_HISTORY_INPUT_ID,
  AI_IMAGE_OUTPUT_ID,
  AI_IMAGE_RESULT_INPUT_ID,
  mergeAiImageNodeCatalogInputs,
} from "./ai-image-node-utils";
import {
  AI_VIDEO_HISTORY_INPUT_ID,
  AI_VIDEO_OUTPUT_ID,
  AI_VIDEO_RESULT_INPUT_ID,
  mergeAiVideoNodeCatalogInputs,
} from "./ai-video-node-utils";
import { mergeAiTextNodeCatalogInputs } from "./ai-text-node-utils";
import { applyHistoryItemSettingsToNode } from "./apply-history-item-settings";
import {
  resolveGenerativeNodeDefaultBaseName,
  resolveGenerativeNodeDisplayName,
} from "./generative-node-naming";
import type { OrgModelBindingRef } from "./org-model-selection-utils";
import { withGenerativeGeneratedContentMode } from "./generative-card-mode-utils";
import { WORKFLOW_NODE_ADD_GAP_PX } from "./workflow-node-placement";
import type { NodeType, WorkflowNodeType } from "./workflow-types";

export type HistoryExpandKind = "image" | "video" | "audio";

export function findHistoryExpandCatalog(
  nodeTypes: readonly NodeType[],
  kind: HistoryExpandKind
): NodeType | undefined {
  const type =
    kind === "image"
      ? AI_IMAGE_NODE_TYPE
      : kind === "video"
        ? AI_VIDEO_NODE_TYPE
        : AI_AUDIO_NODE_TYPE;
  return nodeTypes.find((entry) => entry.type === type);
}

export function computeHistoryExpandNodePosition(
  sourcePosition: { readonly x: number; readonly y: number }
): { readonly x: number; readonly y: number } {
  return {
    x: sourcePosition.x + 280 + WORKFLOW_NODE_ADD_GAP_PX,
    y: sourcePosition.y,
  };
}

function upsertParam(
  inputs: WorkflowNodeType["inputs"],
  id: string,
  value: unknown,
  type: WorkflowNodeType["inputs"][number]["type"] = "string"
): WorkflowNodeType["inputs"] {
  if (inputs.some((input) => input.id === id)) {
    return inputs.map((input) =>
      input.id === id ? { ...input, value } : input
    );
  }
  return [...inputs, { id, name: id, type, value }];
}

export function buildSiblingNodeFromHistoryItem(params: {
  readonly kind: HistoryExpandKind;
  readonly catalog: NodeType;
  readonly sourceNodeName: string;
  readonly sourcePosition: { readonly x: number; readonly y: number };
  readonly media: MediaReference;
  readonly prompt: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly platformModelId?: string;
  readonly aiInterfaceId?: string;
  readonly modelDisplayName?: string;
  readonly createdAt: string;
  readonly models: readonly OrgModelBindingRef[];
  readonly existingNodes: ReadonlyArray<ReactFlowNode<WorkflowNodeType>>;
  readonly createObjectUrl: (
    objectReference: import("@dafthunk/types").ObjectReference
  ) => string;
  readonly t: (key: string) => string;
}): ReactFlowNode<WorkflowNodeType> {
  const nodeId = `${params.catalog.type}-history-${Date.now()}`;
  const position = computeHistoryExpandNodePosition(params.sourcePosition);
  const nodeName = resolveGenerativeNodeDisplayName({
    nodeType: params.catalog.type,
    baseName: resolveGenerativeNodeDefaultBaseName(
      params.catalog.type,
      params.catalog.name,
      params.t
    ),
    existingNodes: params.existingNodes,
  });

  const historyItemId = `gen-expand-${Date.now()}`;
  let inputs = mergeAiTextNodeCatalogInputs(
    params.catalog.type,
    params.catalog.inputs.map((param) => ({
      ...param,
      id: param.name,
    })),
    params.catalog
  );

  if (params.kind === "image") {
    inputs = mergeAiImageNodeCatalogInputs(
      params.catalog.type,
      inputs,
      params.catalog
    );
  } else if (params.kind === "video") {
    inputs = mergeAiVideoNodeCatalogInputs(
      params.catalog.type,
      inputs,
      params.catalog
    );
  } else {
    inputs = mergeAiAudioNodeCatalogInputs(
      params.catalog.type,
      inputs,
      params.catalog
    );
  }

  inputs = upsertParam(inputs, "prompt", params.prompt, "string");

  if (params.kind === "image") {
    inputs = upsertParam(inputs, AI_IMAGE_RESULT_INPUT_ID, [params.media], "json");
    inputs = upsertParam(
      inputs,
      AI_IMAGE_HISTORY_INPUT_ID,
      {
        items: [
          {
            id: historyItemId,
            images: [params.media],
            prompt: params.prompt,
            params: params.params,
            platformModelId: params.platformModelId,
            aiInterfaceId: params.aiInterfaceId,
            modelDisplayName: params.modelDisplayName,
            createdAt: params.createdAt,
          },
        ],
        selectedId: historyItemId,
      },
      "json"
    );
    inputs = upsertParam(inputs, "manual_images", [], "json");
  } else if (params.kind === "video") {
    inputs = upsertParam(inputs, AI_VIDEO_RESULT_INPUT_ID, [params.media], "json");
    inputs = upsertParam(
      inputs,
      AI_VIDEO_HISTORY_INPUT_ID,
      {
        items: [
          {
            id: historyItemId,
            videos: [params.media],
            prompt: params.prompt,
            params: params.params,
            platformModelId: params.platformModelId,
            aiInterfaceId: params.aiInterfaceId,
            modelDisplayName: params.modelDisplayName,
            createdAt: params.createdAt,
          },
        ],
        selectedId: historyItemId,
      },
      "json"
    );
    inputs = upsertParam(inputs, "manual_videos", [], "json");
  } else {
    inputs = upsertParam(inputs, AI_AUDIO_RESULT_INPUT_ID, [params.media], "json");
    inputs = upsertParam(
      inputs,
      AI_AUDIO_HISTORY_INPUT_ID,
      {
        items: [
          {
            id: historyItemId,
            audios: [params.media],
            prompt: params.prompt,
            params: params.params,
            platformModelId: params.platformModelId,
            aiInterfaceId: params.aiInterfaceId,
            modelDisplayName: params.modelDisplayName,
            createdAt: params.createdAt,
          },
        ],
        selectedId: historyItemId,
      },
      "json"
    );
    inputs = upsertParam(inputs, "manual_audios", [], "json");
  }

  const outputId =
    params.kind === "image"
      ? AI_IMAGE_OUTPUT_ID
      : params.kind === "video"
        ? AI_VIDEO_OUTPUT_ID
        : AI_AUDIO_OUTPUT_ID;

  const baseData: WorkflowNodeType = {
    name: nodeName,
    nodeType: params.catalog.type,
    icon: params.catalog.icon,
    inputs,
    outputs: params.catalog.outputs.map((param) => ({
      ...param,
      id: param.name,
      value: param.name === outputId ? [params.media] : param.value,
    })),
    executionState: "idle",
    createObjectUrl: params.createObjectUrl,
  };

  const settings = applyHistoryItemSettingsToNode({
    current: baseData,
    modality: params.kind,
    models: params.models,
    historyBinding: {
      platformModelId: params.platformModelId,
      aiInterfaceId: params.aiInterfaceId,
    },
    historyParams: params.params,
  });

  return {
    id: nodeId,
    type: "workflowNode",
    position,
    selected: true,
    data: {
      ...baseData,
      inputs: settings.patch.inputs ?? baseData.inputs,
      metadata: withGenerativeGeneratedContentMode(settings.patch.metadata),
    },
  };
}
