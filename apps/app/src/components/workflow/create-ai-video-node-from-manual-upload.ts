import {
  AI_VIDEO_NODE_TYPE,
  type ObjectReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import {
  mergeAiVideoNodeCatalogInputs,
  withAiVideoManualUpload,
} from "./ai-video-node-utils";
import { mergeAiTextNodeCatalogInputs } from "./ai-text-node-utils";
import {
  withGenerativeBottomPanelHidden,
  withGenerativeManualContentMode,
} from "./generative-card-mode-utils";
import { withGenerativeTrimmingProgress } from "./generative-progress-utils";
import type { NodeType, WorkflowNodeType } from "./workflow-types";

interface GenerativeNamingNode {
  readonly data: {
    readonly name?: string;
  };
}

export function resolveTrimSiblingNodeName(params: {
  readonly sourceNodeName: string;
  readonly existingNodes: ReadonlyArray<GenerativeNamingNode>;
}): string {
  const base = `${params.sourceNodeName}-截取`;
  const existingNames = new Set(
    params.existingNodes
      .map((node) => node.data.name?.trim())
      .filter((name): name is string => Boolean(name))
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

function buildCatalogAiVideoNodeData(params: {
  readonly catalog: NodeType;
  readonly nodeName: string;
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
}): WorkflowNodeType {
  const catalogInputs = mergeAiVideoNodeCatalogInputs(
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

  return {
    name: params.nodeName,
    nodeType: params.catalog.type,
    icon: params.catalog.icon,
    inputs: catalogInputs,
    outputs: catalogOutputs,
    executionState: "idle",
    createObjectUrl: params.createObjectUrl,
  };
}

export function buildEmptyAiVideoSiblingNode(params: {
  readonly catalog: NodeType;
  readonly nodeId: string;
  readonly nodeName: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
}): ReactFlowNode<WorkflowNodeType> {
  const baseData = buildCatalogAiVideoNodeData({
    catalog: params.catalog,
    nodeName: params.nodeName,
    createObjectUrl: params.createObjectUrl,
  });

  return {
    id: params.nodeId,
    type: "workflowNode",
    position: params.position,
    selected: true,
    data: {
      ...baseData,
      metadata: withGenerativeTrimmingProgress(
        withGenerativeBottomPanelHidden(
          withGenerativeManualContentMode(undefined)
        ),
        true
      ),
    },
  };
}

export function buildAiVideoNodeFromManualUpload(params: {
  readonly catalog: NodeType;
  readonly nodeId: string;
  readonly nodeName: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly video: WorkflowMediaValue;
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
}): ReactFlowNode<WorkflowNodeType> {
  const baseData = buildCatalogAiVideoNodeData({
    catalog: params.catalog,
    nodeName: params.nodeName,
    createObjectUrl: params.createObjectUrl,
  });

  const manualPatch = withAiVideoManualUpload(baseData, [params.video]);

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

export function findAiVideoCatalog(
  nodeTypes: readonly NodeType[]
): NodeType | undefined {
  return nodeTypes.find((entry) => entry.type === AI_VIDEO_NODE_TYPE);
}
