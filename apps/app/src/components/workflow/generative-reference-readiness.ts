import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  isDisplayableWorkflowMedia,
  isFailedResourceRef,
} from "@dafthunk/types";

import {
  isAiAudioGenerating,
  readAiAudioCardAudios,
  AI_AUDIO_PROMPT_HANDLE_ID,
} from "./ai-audio-node-utils";
import {
  isAiImageGenerating,
  readAiImageCardPrimaryImage,
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
} from "./ai-image-node-utils";
import {
  isAiTextGenerating,
  AI_TEXT_KEYWORDS_HANDLE_ID,
  classifyReferenceFromNodeType,
} from "./ai-text-node-utils";
import {
  isAiVideoGenerating,
  readAiVideoCardPrimaryVideo,
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
} from "./ai-video-node-utils";
import {
  readAiTextGeneratingResourceId,
  readAiTextResultReference,
} from "./ai-text-persist-utils";
import { readAiTextStagingDisplayState } from "./ai-text-staging-display-state";
import {
  isUpstreamAiTextFailedLoad,
  isUpstreamAiTextPendingLoad,
} from "./resolve-ai-text-result";
import type { WorkflowNodeType } from "./workflow-types";

export type GenerativeReferenceReadinessReason =
  | "generating"
  | "failed"
  | "not_ready"
  | "empty";

export interface GenerativeReferenceReadinessVerdict {
  readonly ok: boolean;
  readonly reason?: GenerativeReferenceReadinessReason;
}

function evaluateMediaSourceReadiness(
  sourceData: WorkflowNodeType,
  readMedia: () => ReturnType<typeof readAiImageCardPrimaryImage>,
  isGenerating: (metadata?: Record<string, string>) => boolean
): GenerativeReferenceReadinessVerdict {
  if (isGenerating(sourceData.metadata)) {
    return { ok: false, reason: "generating" };
  }

  const media = readMedia();
  if (!media) {
    return { ok: false, reason: "empty" };
  }
  if (isFailedResourceRef(media)) {
    return { ok: false, reason: "failed" };
  }
  if (!isDisplayableWorkflowMedia(media)) {
    return { ok: false, reason: "generating" };
  }

  return { ok: true };
}

function evaluateTextSourceReadiness(params: {
  readonly sourceData: WorkflowNodeType;
  readonly targetNodeType?: string;
  readonly targetHandleId?: string | null;
}): GenerativeReferenceReadinessVerdict {
  if (isAiTextGenerating(params.sourceData.metadata)) {
    return { ok: false, reason: "generating" };
  }

  const reference = readAiTextResultReference(params.sourceData.inputs);
  if (reference && isFailedResourceRef(reference)) {
    return { ok: false, reason: "failed" };
  }
  if (readAiTextGeneratingResourceId(params.sourceData.inputs)) {
    return { ok: false, reason: "generating" };
  }
  if (isUpstreamAiTextFailedLoad(params.sourceData)) {
    return { ok: false, reason: "failed" };
  }
  if (isUpstreamAiTextPendingLoad(params.sourceData)) {
    return { ok: false, reason: "not_ready" };
  }

  const requiresBody =
    params.targetNodeType === AI_TEXT_NODE_TYPE &&
    params.targetHandleId === AI_TEXT_KEYWORDS_HANDLE_ID;
  if (
    requiresBody &&
    (!reference ||
      readAiTextStagingDisplayState(params.sourceData.metadata) === "empty")
  ) {
    return { ok: false, reason: "empty" };
  }

  return { ok: true };
}

/** Read-only: whether a source node's current output is ready to be referenced. */
export function evaluateGenerativeReferenceReadiness(params: {
  readonly sourceData: WorkflowNodeType;
  readonly targetNodeType?: string;
  readonly targetHandleId?: string | null;
}): GenerativeReferenceReadinessVerdict {
  const nodeType = params.sourceData.nodeType;

  if (nodeType === AI_TEXT_NODE_TYPE) {
    return evaluateTextSourceReadiness(params);
  }

  if (nodeType === AI_IMAGE_NODE_TYPE) {
    return evaluateMediaSourceReadiness(
      params.sourceData,
      () =>
        readAiImageCardPrimaryImage(
          params.sourceData.inputs,
          params.sourceData.outputs,
          params.sourceData.metadata
        ),
      isAiImageGenerating
    );
  }

  if (nodeType === AI_VIDEO_NODE_TYPE) {
    return evaluateMediaSourceReadiness(
      params.sourceData,
      () =>
        readAiVideoCardPrimaryVideo(
          params.sourceData.inputs,
          params.sourceData.outputs,
          params.sourceData.metadata
        ),
      isAiVideoGenerating
    );
  }

  if (nodeType === AI_AUDIO_NODE_TYPE) {
    return evaluateMediaSourceReadiness(
      params.sourceData,
      () =>
        readAiAudioCardAudios(
          params.sourceData.inputs,
          params.sourceData.outputs,
          params.sourceData.metadata
        )[0],
      isAiAudioGenerating
    );
  }

  const kind = classifyReferenceFromNodeType(nodeType);
  if (!kind) {
    return { ok: false, reason: "empty" };
  }

  return { ok: true };
}

export function isGenerativeReferenceInputTarget(
  targetNodeType: string | undefined,
  inputHandleId: string | null | undefined
): boolean {
  return (
    (targetNodeType === AI_TEXT_NODE_TYPE &&
      inputHandleId === AI_TEXT_KEYWORDS_HANDLE_ID) ||
    (targetNodeType === AI_IMAGE_NODE_TYPE &&
      (inputHandleId === AI_IMAGE_REFERENCE_HANDLE_ID ||
        inputHandleId === AI_IMAGE_PROMPT_HANDLE_ID)) ||
    (targetNodeType === AI_VIDEO_NODE_TYPE &&
      (inputHandleId === AI_VIDEO_REFERENCE_HANDLE_ID ||
        inputHandleId === AI_VIDEO_PROMPT_HANDLE_ID)) ||
    (targetNodeType === AI_AUDIO_NODE_TYPE &&
      inputHandleId === AI_AUDIO_PROMPT_HANDLE_ID)
  );
}
