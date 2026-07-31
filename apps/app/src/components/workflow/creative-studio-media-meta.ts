import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";

import { readAiAudioResultHistory } from "./ai-audio-node-utils";
import { readAiImageResultHistory } from "./ai-image-node-utils";
import { readAiTextResultHistory } from "./ai-text-node-utils";
import { readAiVideoResultHistory } from "./ai-video-node-utils";
import type { WorkflowNodeType } from "./workflow-types";

function readParamsRecord(
  data: WorkflowNodeType
): Readonly<Record<string, unknown>> {
  const raw = data.inputs.find((input) => input.id === "params")?.value;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function readStudioModelLabel(
  data: WorkflowNodeType
): string | null {
  if (data.nodeType === AI_IMAGE_NODE_TYPE) {
    const history = readAiImageResultHistory(data.inputs);
    const selected = history.selectedId
      ? history.items.find((item) => item.id === history.selectedId)
      : null;
    return selected?.platformModelId?.trim() || null;
  }

  if (data.nodeType === AI_VIDEO_NODE_TYPE) {
    const history = readAiVideoResultHistory(data.inputs);
    const selected = history.selectedId
      ? history.items.find((item) => item.id === history.selectedId)
      : null;
    return selected?.platformModelId?.trim() || null;
  }

  if (data.nodeType === AI_AUDIO_NODE_TYPE) {
    const history = readAiAudioResultHistory(data.inputs);
    const selected = history.selectedId
      ? history.items.find((item) => item.id === history.selectedId)
      : null;
    return selected?.platformModelId?.trim() || null;
  }

  if (data.nodeType === AI_TEXT_NODE_TYPE) {
    const history = readAiTextResultHistory(data.inputs);
    const selected = history.selectedId
      ? history.items.find((item) => item.id === history.selectedId)
      : null;
    return selected?.platformModelId?.trim() || null;
  }

  return null;
}

export function readStudioVideoResolution(
  data: WorkflowNodeType
): string | null {
  const raw = readParamsRecord(data).resolution;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}
