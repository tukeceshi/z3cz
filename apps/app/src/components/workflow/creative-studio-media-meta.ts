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
import {
  readHistoryModelDisplayName,
  readHistoryResolutionLabel,
} from "./generative-history-utils";
import type { WorkflowNodeType } from "./workflow-types";

function readSelectedHistoryModelDisplayName<
  TItem extends { readonly id: string; readonly modelDisplayName?: string },
>(history: {
  readonly items: readonly TItem[];
  readonly selectedId: string | null;
}): string | null {
  if (!history.selectedId) {
    return null;
  }
  const selected = history.items.find((item) => item.id === history.selectedId);
  return readHistoryModelDisplayName(selected);
}

export function readStudioModelLabel(data: WorkflowNodeType): string | null {
  if (data.nodeType === AI_IMAGE_NODE_TYPE) {
    return readSelectedHistoryModelDisplayName(
      readAiImageResultHistory(data.inputs)
    );
  }

  if (data.nodeType === AI_VIDEO_NODE_TYPE) {
    return readSelectedHistoryModelDisplayName(
      readAiVideoResultHistory(data.inputs)
    );
  }

  if (data.nodeType === AI_AUDIO_NODE_TYPE) {
    return readSelectedHistoryModelDisplayName(
      readAiAudioResultHistory(data.inputs)
    );
  }

  if (data.nodeType === AI_TEXT_NODE_TYPE) {
    return readSelectedHistoryModelDisplayName(
      readAiTextResultHistory(data.inputs)
    );
  }

  return null;
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
