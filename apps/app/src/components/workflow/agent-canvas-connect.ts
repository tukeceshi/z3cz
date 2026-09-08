import type { AiGenerativeNodeType } from "@dafthunk/types";
import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import type { Connection, Node as ReactFlowNode } from "@xyflow/react";

import {
  buildGenerativeReferenceConnectionFromCardDrop,
  buildPanelReferenceConnection,
} from "./generative-reference-connection";
import type { WorkflowNodeType } from "./workflow-types";

export type AgentGenerationMode = "text" | "image" | "video" | "audio";

export function generationModeToNodeType(
  mode: AgentGenerationMode
): AiGenerativeNodeType {
  if (mode === "image") {
    return AI_IMAGE_NODE_TYPE;
  }
  if (mode === "video") {
    return AI_VIDEO_NODE_TYPE;
  }
  if (mode === "audio") {
    return AI_AUDIO_NODE_TYPE;
  }
  return AI_TEXT_NODE_TYPE;
}

export function parseGenerationMode(
  value: unknown
): AgentGenerationMode | undefined {
  if (
    value === "text" ||
    value === "image" ||
    value === "video" ||
    value === "audio"
  ) {
    return value;
  }
  return undefined;
}

export function findAgentReferenceConnection(params: {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): Connection | null {
  const source = params.nodes.find((node) => node.id === params.fromNodeId);
  if (!source) {
    return null;
  }
  const outputs = source.data.outputs ?? [];
  for (const output of outputs) {
    const handleId = output.id || output.name;
    if (!handleId) {
      continue;
    }
    const connection = buildPanelReferenceConnection({
      sourceNodeId: params.fromNodeId,
      sourceHandle: handleId,
      targetNodeId: params.toNodeId,
      nodes: params.nodes,
    });
    if (connection) {
      return connection;
    }
  }
  return buildGenerativeReferenceConnectionFromCardDrop({
    dragFromNodeId: params.fromNodeId,
    dragFromHandle: { type: "source", id: null },
    hoveredNodeId: params.toNodeId,
    nodes: params.nodes,
  });
}
