import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  normalizeImageModelParameterRules,
  normalizeTextModelParameterRules,
  normalizeVideoModelParameterRules,
  type AiGenerativeNodeType,
  type OrgAudioModelOption,
  type OrgImageModelOption,
  type OrgTextModelOption,
  type OrgVideoModelOption,
  type SubmitAiVideoMediaReferenceCounts,
} from "@dafthunk/types";
import type { Connection } from "@xyflow/react";

import {
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
  referencesFitImageModelLimits,
} from "./ai-image-node-utils";
import {
  AI_VIDEO_PROMPT_HANDLE_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
  classifyAiVideoReferenceFromNodeType,
  referencesFitVideoModelLimits,
} from "./ai-video-node-utils";
import {
  classifyReferenceFromNodeType,
  emptyAiTextReferenceCounts,
  referencesFitModelLimits,
  type AiTextReferenceCounts,
} from "./ai-text-node-utils";
import type { OrgModelBindingRef } from "./org-model-selection-utils";

type GenerativeOrgModel =
  | OrgTextModelOption
  | OrgImageModelOption
  | OrgVideoModelOption
  | OrgAudioModelOption;

export function textModelFitsReferenceCounts(
  model: OrgTextModelOption,
  counts: AiTextReferenceCounts
): boolean {
  return referencesFitModelLimits(
    counts,
    normalizeTextModelParameterRules(model.parameterRules)
  );
}

export function imageModelFitsReferenceCount(
  model: OrgImageModelOption,
  referenceCount: number
): boolean {
  return referencesFitImageModelLimits(
    referenceCount,
    normalizeImageModelParameterRules(model.parameterRules)
  );
}

export function videoModelFitsReferenceCounts(
  model: OrgVideoModelOption,
  counts: SubmitAiVideoMediaReferenceCounts
): boolean {
  return referencesFitVideoModelLimits(
    counts,
    normalizeVideoModelParameterRules(model.parameterRules)
  );
}

/** @deprecated Prefer videoModelFitsReferenceCounts. */
export function videoModelFitsReferenceCount(
  model: OrgVideoModelOption,
  referenceCount: number
): boolean {
  return videoModelFitsReferenceCounts(model, {
    imageCount: referenceCount,
    videoCount: 0,
    audioCount: 0,
  });
}

/** Projected reference counts for a would-be connection onto a new empty node. */
export function projectedReferenceCountsForConnection(params: {
  readonly targetType: AiGenerativeNodeType;
  readonly connection: Connection;
  readonly sourceNodeType: string | undefined;
}): {
  readonly textCounts: AiTextReferenceCounts;
  readonly imageReferenceCount: number;
  readonly videoReferenceCount: number;
  readonly audioReferenceCount: number;
  readonly countsAsPromptOnly: boolean;
} {
  const textCounts = emptyAiTextReferenceCounts();
  let imageReferenceCount = 0;
  let videoReferenceCount = 0;
  let audioReferenceCount = 0;
  let countsAsPromptOnly = false;

  switch (params.targetType) {
    case AI_TEXT_NODE_TYPE: {
      const kind = classifyReferenceFromNodeType(params.sourceNodeType);
      if (kind) {
        textCounts[kind] = 1;
      }
      break;
    }
    case AI_IMAGE_NODE_TYPE:
      if (params.connection.targetHandle === AI_IMAGE_PROMPT_HANDLE_ID) {
        countsAsPromptOnly = true;
      } else if (
        params.connection.targetHandle === AI_IMAGE_REFERENCE_HANDLE_ID
      ) {
        imageReferenceCount = 1;
      }
      break;
    case AI_VIDEO_NODE_TYPE:
      if (params.connection.targetHandle === AI_VIDEO_PROMPT_HANDLE_ID) {
        countsAsPromptOnly = true;
      } else if (
        params.connection.targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID
      ) {
        const kind = classifyAiVideoReferenceFromNodeType(
          params.sourceNodeType
        );
        if (kind === "image") imageReferenceCount = 1;
        else if (kind === "video") videoReferenceCount = 1;
        else if (kind === "audio") audioReferenceCount = 1;
      }
      break;
    case AI_AUDIO_NODE_TYPE:
      countsAsPromptOnly = true;
      break;
    default:
      break;
  }

  return {
    textCounts,
    imageReferenceCount,
    videoReferenceCount,
    audioReferenceCount,
    countsAsPromptOnly,
  };
}

export function createProjectedModelFits(params: {
  readonly targetType: AiGenerativeNodeType;
  readonly connection: Connection;
  readonly sourceNodeType: string | undefined;
}): (model: OrgModelBindingRef) => boolean {
  const projected = projectedReferenceCountsForConnection(params);

  if (projected.countsAsPromptOnly) {
    return (model) => model.selectable;
  }

  switch (params.targetType) {
    case AI_TEXT_NODE_TYPE:
      return (model) =>
        model.selectable &&
        textModelFitsReferenceCounts(
          model as OrgTextModelOption,
          projected.textCounts
        );
    case AI_IMAGE_NODE_TYPE:
      return (model) =>
        model.selectable &&
        imageModelFitsReferenceCount(
          model as OrgImageModelOption,
          projected.imageReferenceCount
        );
    case AI_VIDEO_NODE_TYPE:
      return (model) =>
        model.selectable &&
        videoModelFitsReferenceCounts(model as OrgVideoModelOption, {
          imageCount: projected.imageReferenceCount,
          videoCount: projected.videoReferenceCount,
          audioCount: projected.audioReferenceCount,
        });
    case AI_AUDIO_NODE_TYPE:
      return (model) => model.selectable;
    default:
      return () => false;
  }
}
