import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";

import { readAiVideoResultHistory } from "./ai-video-node-utils";
import { readHistoryResolutionLabel } from "./generative-history-utils";
import type { WorkflowNodeType } from "./workflow-types";

function readBindingModelLabel(data: WorkflowNodeType): string | null {
  const modelValue = data.inputs?.find((input) => input.id === "model")?.value;
  if (typeof modelValue !== "string") {
    return null;
  }
  const trimmed = modelValue.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Current card model binding for studio list footer labels. */
export function readStudioModelLabel(data: WorkflowNodeType): string | null {
  if (
    data.nodeType !== AI_IMAGE_NODE_TYPE &&
    data.nodeType !== AI_VIDEO_NODE_TYPE &&
    data.nodeType !== AI_AUDIO_NODE_TYPE &&
    data.nodeType !== AI_TEXT_NODE_TYPE
  ) {
    return null;
  }

  return readBindingModelLabel(data);
}

export function readStudioVideoResolution(
  data: WorkflowNodeType
): string | null {
  const history = readAiVideoResultHistory(data.inputs);
  const selected = history.selectedId
    ? history.items.find((item) => item.id === history.selectedId)
    : null;
  return readHistoryResolutionLabel(selected?.params);
}
