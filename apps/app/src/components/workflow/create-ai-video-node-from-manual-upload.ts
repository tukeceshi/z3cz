import {
  AI_VIDEO_NODE_TYPE,
  type ObjectReference,
  withAiVideoPanelKind,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import {
  mergeAiVideoNodeCatalogInputs,
  withAiVideoGeneratingFlag,
  withAiVideoManualUpload,
} from "./ai-video-node-utils";
import { mergeAiTextNodeCatalogInputs } from "./ai-text-node-utils";
import {
  withGenerativeBottomPanelHidden,
  withGenerativeManualContentMode,
} from "./generative-card-mode-utils";
import {
  withGenerativeProgress,
  withGenerativeTrimmingProgress,
} from "./generative-progress-utils";
import { createDefaultAiVideoRetakeDraft } from "./ai-video-retake-node-utils";
import type { NodeType, WorkflowNodeType } from "./workflow-types";

export type AiVideoSiblingBusyKind = "trimming" | "generating" | "none";

interface GenerativeNamingNode {
  readonly data: {
    readonly name?: string;
  };
}

function resolveNumberedSiblingNodeName(
  base: string,
  existingNodes: ReadonlyArray<GenerativeNamingNode>
): string {
  const existingNames = new Set(
    existingNodes
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

export function resolveTrimSiblingNodeName(params: {
  readonly sourceNodeName: string;
  readonly existingNodes: ReadonlyArray<GenerativeNamingNode>;
}): string {
  return resolveNumberedSiblingNodeName(
    `${params.sourceNodeName}-截取`,
    params.existingNodes
  );
}

export function resolveRetakeSiblingNodeName(params: {
  readonly sourceNodeName: string;
  readonly existingNodes: ReadonlyArray<GenerativeNamingNode>;
}): string {
  return resolveNumberedSiblingNodeName(
    `${params.sourceNodeName}-重拍`,
    params.existingNodes
  );
}

export function isAiVideoResultSiblingNodeId(nodeId: string): boolean {
  return (
    nodeId.startsWith(`${AI_VIDEO_NODE_TYPE}-retake-`) ||
    nodeId.startsWith(`${AI_VIDEO_NODE_TYPE}-trim-`)
  );
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
  readonly initialBusy?: AiVideoSiblingBusyKind;
}): ReactFlowNode<WorkflowNodeType> {
  const baseData = buildCatalogAiVideoNodeData({
    catalog: params.catalog,
    nodeName: params.nodeName,
    createObjectUrl: params.createObjectUrl,
  });

  const hiddenPanel = withGenerativeBottomPanelHidden(
    withGenerativeManualContentMode(undefined)
  );
  const busyKind = params.initialBusy ?? "trimming";
  const metadata =
    busyKind === "generating"
      ? withGenerativeProgress(withAiVideoGeneratingFlag(hiddenPanel, true), {
          phase: "generating",
        })
      : busyKind === "none"
        ? hiddenPanel
        : withGenerativeTrimmingProgress(hiddenPanel, true);

  return {
    id: params.nodeId,
    type: "workflowNode",
    position: params.position,
    selected: true,
    data: {
      ...baseData,
      metadata,
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

/** Locked retake window — cover video only, no history, no edges. */
export function buildLockedRetakeCopyNode(params: {
  readonly catalog: NodeType;
  readonly nodeId: string;
  readonly nodeName: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly video: WorkflowMediaValue;
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
}): ReactFlowNode<WorkflowNodeType> {
  const node = buildAiVideoNodeFromManualUpload(params);
  const hiddenPanel = withGenerativeBottomPanelHidden(node.data.metadata);
  const draft = createDefaultAiVideoRetakeDraft();
  return {
    ...node,
    data: {
      ...node.data,
      inputs: [
        ...node.data.inputs,
        {
          id: "retake_draft",
          name: "retake_draft",
          type: "json",
          hidden: true,
          value: draft,
        },
      ],
      metadata: withAiVideoPanelKind(hiddenPanel, "retake"),
    },
  };
}

export function findAiVideoCatalog(
  nodeTypes: readonly NodeType[]
): NodeType | undefined {
  return nodeTypes.find((entry) => entry.type === AI_VIDEO_NODE_TYPE);
}
