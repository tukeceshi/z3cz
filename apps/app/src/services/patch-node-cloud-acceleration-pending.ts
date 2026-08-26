import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  isGeneratingResourceRef,
  patchNodeMediaCloudAccelerationStatus,
  type Node,
  type WorkflowMediaValue,
} from "@dafthunk/types";

import {
  readAiAudioResult,
  readAiAudioResultHistory,
} from "@/components/workflow/ai-audio-node-utils";
import {
  readAiImageResult,
  readAiImageResultHistory,
} from "@/components/workflow/ai-image-node-utils";
import {
  readAiVideoResult,
  readAiVideoResultHistory,
} from "@/components/workflow/ai-video-node-utils";
import type { WorkflowNodeType, WorkflowParameter } from "@/components/workflow/workflow-types";

function collectGeneratingResourceIds(
  media: readonly WorkflowMediaValue[]
): readonly string[] {
  return [
    ...new Set(
      media
        .filter(isGeneratingResourceRef)
        .map((item) => item.resourceId)
        .filter((id) => id.trim().length > 0)
    ),
  ];
}

function listNodeMedia(node: WorkflowNodeType): readonly WorkflowMediaValue[] {
  const inputs = node.inputs as WorkflowParameter[];
  const outputs = node.outputs as WorkflowParameter[];
  const nodeType = node.nodeType;

  if (nodeType === AI_IMAGE_NODE_TYPE) {
    return [
      ...readAiImageResult(inputs, outputs),
      ...readAiImageResultHistory(inputs).items.flatMap((item) => item.images),
    ];
  }

  if (nodeType === AI_VIDEO_NODE_TYPE) {
    return [
      ...readAiVideoResult(inputs, outputs),
      ...readAiVideoResultHistory(inputs).items.flatMap((item) => item.videos),
    ];
  }

  if (nodeType === AI_AUDIO_NODE_TYPE) {
    return [
      ...readAiAudioResult(inputs, outputs),
      ...readAiAudioResultHistory(inputs).items.flatMap((item) => item.audios),
    ];
  }

  return [];
}

function asPatchNode(node: WorkflowNodeType): Node | null {
  const nodeType = node.nodeType;
  if (
    nodeType !== AI_IMAGE_NODE_TYPE &&
    nodeType !== AI_VIDEO_NODE_TYPE &&
    nodeType !== AI_AUDIO_NODE_TYPE
  ) {
    return null;
  }

  return {
    id: "",
    name: node.name,
    type: nodeType,
    position: { x: 0, y: 0 },
    inputs: node.inputs as Node["inputs"],
    outputs: node.outputs as Node["outputs"],
  };
}

/** Optimistically mark in-flight refs as cloud-accelerating on the node JSON. */
export function patchWorkflowNodeCloudAccelerationPending(
  node: WorkflowNodeType
): Partial<WorkflowNodeType> | null {
  const resourceIds = collectGeneratingResourceIds(listNodeMedia(node));
  if (resourceIds.length === 0) {
    return null;
  }

  const patchNode = asPatchNode(node);
  if (!patchNode) {
    return null;
  }

  const contentPatch = patchNodeMediaCloudAccelerationStatus(patchNode, {
    resourceIds,
    status: "pending",
  });
  if (!contentPatch?.inputs && !contentPatch?.outputs) {
    return null;
  }

  return {
    ...(contentPatch.inputs ? { inputs: contentPatch.inputs as WorkflowParameter[] } : {}),
    ...(contentPatch.outputs
      ? { outputs: contentPatch.outputs as WorkflowParameter[] }
      : {}),
  };
}
