import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import { readAiAudioResultHistory } from "@/components/workflow/ai-audio-node-utils";
import { readAiImageResultHistory } from "@/components/workflow/ai-image-node-utils";
import { readAiTextResultHistory } from "@/components/workflow/ai-text-node-utils";
import { readAiVideoResultHistory } from "@/components/workflow/ai-video-node-utils";
import type { WorkflowNodeType } from "@/components/workflow/workflow-types";

/** True when the node has generative history rows (any phase). */
export function nodeHasCanvasRecords(
  node: ReactFlowNode<WorkflowNodeType>
): boolean {
  const nodeType = node.data.nodeType;
  const inputs = node.data.inputs;

  switch (nodeType) {
    case AI_TEXT_NODE_TYPE:
      return readAiTextResultHistory(inputs).items.length > 0;
    case AI_IMAGE_NODE_TYPE:
      return readAiImageResultHistory(inputs).items.length > 0;
    case AI_VIDEO_NODE_TYPE:
      return readAiVideoResultHistory(inputs).items.length > 0;
    case AI_AUDIO_NODE_TYPE:
      return readAiAudioResultHistory(inputs).items.length > 0;
    default:
      return false;
  }
}

export function filterNodesWithCanvasRecords(
  nodes: readonly ReactFlowNode<WorkflowNodeType>[],
  nodeIds: readonly string[]
): ReactFlowNode<WorkflowNodeType>[] {
  const idSet = new Set(nodeIds);
  return nodes.filter(
    (node) => idSet.has(node.id) && nodeHasCanvasRecords(node)
  );
}
