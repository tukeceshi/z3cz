import type { Connection, Node as ReactFlowNode } from "@xyflow/react";

import { buildAiAudioPromptReferenceConnectionFromCardDrop } from "./ai-audio-prompt-reference";
import { buildAiImagePromptReferenceConnectionFromCardDrop } from "./ai-image-prompt-reference";
import { buildAiImageReferenceConnectionFromCardDrop } from "./ai-image-reference-policy";
import { buildAiTextReferenceConnectionFromCardDrop } from "./ai-text-reference-policy";
import { buildAiVideoPromptReferenceConnectionFromCardDrop } from "./ai-video-prompt-reference";
import { buildAiVideoReferenceConnectionFromCardDrop } from "./ai-video-reference-policy";
import type { WorkflowNodeType } from "./workflow-types";

export interface AddNodeConnectionDragHandle {
  readonly type: string;
  readonly id?: string | null;
}

/** Build a reference edge from an existing source output handle to a newly created target node. */
export function buildReferenceConnectionToNewNode(params: {
  readonly dragFromNodeId: string;
  readonly dragFromHandle: AddNodeConnectionDragHandle | null;
  readonly targetNodeId: string;
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): Connection | null {
  if (!params.dragFromHandle || params.dragFromHandle.type !== "source") {
    return null;
  }

  const drop =
    buildAiTextReferenceConnectionFromCardDrop({
      dragFromNodeId: params.dragFromNodeId,
      dragFromHandle: params.dragFromHandle,
      hoveredNodeId: params.targetNodeId,
      nodes: params.nodes,
    }) ??
    buildAiImagePromptReferenceConnectionFromCardDrop({
      dragFromNodeId: params.dragFromNodeId,
      dragFromHandle: params.dragFromHandle,
      hoveredNodeId: params.targetNodeId,
      nodes: params.nodes,
    }) ??
    buildAiImageReferenceConnectionFromCardDrop({
      dragFromNodeId: params.dragFromNodeId,
      dragFromHandle: params.dragFromHandle,
      hoveredNodeId: params.targetNodeId,
      nodes: params.nodes,
    }) ??
    buildAiVideoPromptReferenceConnectionFromCardDrop({
      dragFromNodeId: params.dragFromNodeId,
      dragFromHandle: params.dragFromHandle,
      hoveredNodeId: params.targetNodeId,
      nodes: params.nodes,
    }) ??
    buildAiVideoReferenceConnectionFromCardDrop({
      dragFromNodeId: params.dragFromNodeId,
      dragFromHandle: params.dragFromHandle,
      hoveredNodeId: params.targetNodeId,
      nodes: params.nodes,
    }) ??
    buildAiAudioPromptReferenceConnectionFromCardDrop({
      dragFromNodeId: params.dragFromNodeId,
      dragFromHandle: params.dragFromHandle,
      hoveredNodeId: params.targetNodeId,
      nodes: params.nodes,
    });

  return drop;
}
