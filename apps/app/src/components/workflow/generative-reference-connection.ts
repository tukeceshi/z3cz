import type { ObjectReference } from "@dafthunk/types";
import type { Connection, Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { buildAiAudioPromptReferenceConnectionFromCardDrop } from "./ai-audio-prompt-reference";
import { buildAiImagePromptReferenceConnectionFromCardDrop } from "./ai-image-prompt-reference";
import { buildAiImageReferenceConnectionFromCardDrop } from "./ai-image-reference-policy";
import { buildAiTextReferenceConnectionFromCardDrop } from "./ai-text-reference-policy";
import { buildAiVideoPromptReferenceConnectionFromCardDrop } from "./ai-video-prompt-reference";
import { buildAiVideoReferenceConnectionFromCardDrop } from "./ai-video-reference-policy";
import type { GenerativeReferenceModelCatalogs } from "./generative-reference-model-catalogs";
import {
  mergePreparedWorkflowEdge,
  prepareWorkflowConnectionAppend,
} from "./workflow-connection-commit";
import { validateWorkflowConnection } from "./workflow-connection-validation";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface GenerativeReferenceCardDropHandle {
  readonly type: string;
  readonly id?: string | null;
}

export interface GenerativeReferenceCardDropParams {
  readonly dragFromNodeId: string;
  readonly dragFromHandle: GenerativeReferenceCardDropHandle | null;
  readonly hoveredNodeId: string;
  readonly nodes: readonly Pick<ReactFlowNode<WorkflowNodeType>, "id" | "data">[];
}

/** Shared card-drop / add-node routing for generative reference edges. */
export function buildGenerativeReferenceConnectionFromCardDrop(
  params: GenerativeReferenceCardDropParams
): Connection | null {
  return (
    buildAiTextReferenceConnectionFromCardDrop(params) ??
    buildAiImagePromptReferenceConnectionFromCardDrop(params) ??
    buildAiImageReferenceConnectionFromCardDrop(params) ??
    buildAiVideoPromptReferenceConnectionFromCardDrop(params) ??
    buildAiVideoReferenceConnectionFromCardDrop(params) ??
    buildAiAudioPromptReferenceConnectionFromCardDrop(params)
  );
}

/** Bottom-panel pick: same handle routing as canvas card drop. */
export function buildPanelReferenceConnection(params: {
  readonly sourceNodeId: string;
  readonly sourceHandle: string;
  readonly targetNodeId: string;
  readonly nodes: GenerativeReferenceCardDropParams["nodes"];
}): Connection | null {
  return buildGenerativeReferenceConnectionFromCardDrop({
    dragFromNodeId: params.sourceNodeId,
    dragFromHandle: { type: "source", id: params.sourceHandle },
    hoveredNodeId: params.targetNodeId,
    nodes: params.nodes,
  });
}

export function canConnectGenerativeReferenceConnection(params: {
  readonly sourceNodeId: string;
  readonly sourceHandle: string;
  readonly targetNodeId: string;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly generativeReferenceCatalogs?: GenerativeReferenceModelCatalogs;
  readonly disabled?: boolean;
}): boolean {
  const connection = buildPanelReferenceConnection({
    sourceNodeId: params.sourceNodeId,
    sourceHandle: params.sourceHandle,
    targetNodeId: params.targetNodeId,
    nodes: params.nodes,
  });
  if (!connection) {
    return false;
  }

  return validateWorkflowConnection({
    connection,
    nodes: params.nodes,
    edges: params.edges,
    generativeReferenceCatalogs: params.generativeReferenceCatalogs,
    disabled: params.disabled,
  });
}

export interface AppendGenerativeReferenceConnectionParams {
  readonly connection: Connection;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly setEdges: (
    updater: (
      edges: ReactFlowEdge<WorkflowEdgeType>[]
    ) => ReactFlowEdge<WorkflowEdgeType>[]
  ) => void;
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
  readonly generativeReferenceCatalogs?: GenerativeReferenceModelCatalogs;
  readonly disabled?: boolean;
}

/** Commit a generative reference edge through the shared workflow connection pipeline. */
export function appendGenerativeReferenceConnection(
  params: AppendGenerativeReferenceConnectionParams
): boolean {
  const prepared = prepareWorkflowConnectionAppend({
    connection: params.connection,
    nodes: params.nodes,
    edges: params.edges,
    createObjectUrl: params.createObjectUrl,
    generativeReferenceCatalogs: params.generativeReferenceCatalogs,
    disabled: params.disabled,
  });
  if (!prepared) {
    return false;
  }

  params.setEdges((current) => mergePreparedWorkflowEdge(current, prepared));
  return true;
}
