import type { WorkflowMediaValue } from "@dafthunk/types";

import {
  appendAiAudioGeneratedHistoryItems,
  withAiAudioManualUpload,
} from "./ai-audio-node-utils";
import {
  withAiImageGeneratedResult,
  withAiImageManualUpload,
} from "./ai-image-node-utils";
import {
  appendAiVideoGeneratedHistoryItems,
  withAiVideoManualUpload,
} from "./ai-video-node-utils";
import { readGenerativePrompt } from "./generative-card-upload-utils";
import type { WorkflowNodeType } from "./workflow-types";

export function patchGenerativeNodeWithHungMedia(params: {
  readonly current: WorkflowNodeType;
  readonly media: WorkflowMediaValue;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}): Partial<WorkflowNodeType> {
  const prompt = readGenerativePrompt(params.current.inputs).trim();
  if (prompt) {
    if (params.nodeType === "ai-video") {
      return appendAiVideoGeneratedHistoryItems(params.current, [params.media], {
        prompt,
      });
    }
    if (params.nodeType === "ai-audio") {
      return appendAiAudioGeneratedHistoryItems(
        params.current,
        [params.media] as never,
        { prompt }
      );
    }
    return withAiImageGeneratedResult(params.current, [params.media], {
      prompt,
    });
  }

  if (params.nodeType === "ai-video") {
    return withAiVideoManualUpload(params.current, [params.media]);
  }
  if (params.nodeType === "ai-audio") {
    return withAiAudioManualUpload(params.current, [params.media]);
  }
  return withAiImageManualUpload(params.current, [params.media]);
}
