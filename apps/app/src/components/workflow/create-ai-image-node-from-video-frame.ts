import {
  AI_IMAGE_NODE_TYPE,
  type ObjectReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import {
  mergeAiImageNodeCatalogInputs,
  withAiImageManualUpload,
} from "./ai-image-node-utils";
import { mergeAiTextNodeCatalogInputs } from "./ai-text-node-utils";
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
  const base = `${params.frameSuffix}-${params.sourceNodeName}`;
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

export function buildAiImageNodeFromFrameReference(params: {
  readonly catalog: NodeType;
  readonly nodeId: string;
  readonly nodeName: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly image: WorkflowMediaValue;
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
}): ReactFlowNode<WorkflowNodeType> {
  const catalogInputs = mergeAiImageNodeCatalogInputs(
    params.catalog.type,
    mergeAiTextNodeCatalogInputs(
      params.catalog.type,
      params.catalog.inputs.map((param) => ({
        ...param,
        id: param.name,
      })),
      params.catalog
    ),
    params.catalog
  );

  const catalogOutputs = params.catalog.outputs.map((param) => ({
    ...param,
    id: param.name,
  }));

  const baseData: WorkflowNodeType = {
    name: params.nodeName,
    nodeType: params.catalog.type,
    icon: params.catalog.icon,
    inputs: catalogInputs,
    outputs: catalogOutputs,
    executionState: "idle",
    createObjectUrl: params.createObjectUrl,
  };

  const manualPatch = withAiImageManualUpload(baseData, [params.image]);

  return {
    id: params.nodeId,
    type: "workflowNode",
    position: params.position,
    selected: true,
    data: {
      ...baseData,
      ...manualPatch,
    },
  };
}

export function findAiImageCatalog(
  nodeTypes: readonly NodeType[]
): NodeType | undefined {
  return nodeTypes.find((entry) => entry.type === AI_IMAGE_NODE_TYPE);
}
