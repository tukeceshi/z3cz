import {
  AI_IMAGE_NODE_TYPE,
  type ObjectReference,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import {
  AI_IMAGE_CARD_HEIGHT_PX,
  AI_IMAGE_OUTPUT_ID,
  mergeAiImageNodeCatalogInputs,
} from "./ai-image-node-utils";
import {
  AI_VIDEO_CARD_WIDTH_PX,
} from "./ai-video-node-utils";
import { mergeAiTextNodeCatalogInputs } from "./ai-text-node-utils";
import {
  WORKFLOW_NODE_ADD_GAP_PX,
} from "./workflow-node-placement";
import type { NodeType, WorkflowNodeType } from "./workflow-types";

interface GenerativeNamingNode {
  readonly data: {
    readonly name?: string;
  };
}

export function resolveVideoFrameAiImageNodeName(params: {
  readonly sourceNodeName: string;
  readonly frameSuffix: string;
  readonly existingNodes: ReadonlyArray<GenerativeNamingNode>;
}): string {
  const base = `${params.sourceNodeName}-${params.frameSuffix}`;
  const existingNames = new Set(
    params.existingNodes
      .map((node) => node.data.name)
      .filter((name): name is string => typeof name === "string")
  );

  if (!existingNames.has(base)) {
    return base;
  }

  let index = 2;
  while (existingNames.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

export function computeVideoFrameAiImageNodePosition(
  sourcePosition: { readonly x: number; readonly y: number },
  offsetIndex: number
): { readonly x: number; readonly y: number } {
  return {
    x: sourcePosition.x + AI_VIDEO_CARD_WIDTH_PX + WORKFLOW_NODE_ADD_GAP_PX,
    y:
      sourcePosition.y +
      offsetIndex * (AI_IMAGE_CARD_HEIGHT_PX + WORKFLOW_NODE_ADD_GAP_PX),
  };
}

export function buildAiImageNodeFromFrameReference(params: {
  readonly catalog: NodeType;
  readonly nodeId: string;
  readonly nodeName: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly imageRef: ObjectReference;
  readonly existingNodes: ReadonlyArray<ReactFlowNode<WorkflowNodeType>>;
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
}): ReactFlowNode<WorkflowNodeType> {
  const catalogInputs = mergeAiImageNodeCatalogInputs(
    params.catalog.type,
    mergeAiTextNodeCatalogInputs(
      params.catalog.type,
      params.catalog.inputs.map((param) => ({
        ...param,
        id: param.name,
        value: param.name === "manual_images" ? [params.imageRef] : param.value,
      })),
      params.catalog
    ),
    params.catalog
  );

  const catalogOutputs = params.catalog.outputs.map((param) => ({
    ...param,
    id: param.name,
    value:
      param.name === AI_IMAGE_OUTPUT_ID ? [params.imageRef] : param.value,
  }));

  return {
    id: params.nodeId,
    type: "workflowNode",
    position: params.position,
    selected: true,
    data: {
      name: params.nodeName,
      nodeType: params.catalog.type,
      icon: params.catalog.icon,
      inputs: catalogInputs,
      outputs: catalogOutputs,
      executionState: "idle",
      createObjectUrl: params.createObjectUrl,
    },
  };
}

export function findAiImageCatalog(
  nodeTypes: readonly NodeType[]
): NodeType | undefined {
  return nodeTypes.find((entry) => entry.type === AI_IMAGE_NODE_TYPE);
}
