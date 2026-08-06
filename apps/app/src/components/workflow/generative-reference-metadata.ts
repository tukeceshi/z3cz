import {
  normalizeImageModelParameterRules,
  normalizeTextModelParameterRules,
  normalizeVideoModelParameterRules,
  resolveVideoReferenceMode,
  type ImageModelParameterRules,
  type TextModelParameterRules,
  type VideoModelParameterRules,
  type VideoReferenceMode,
} from "@dafthunk/types";

import type { OrgModelBindingRef } from "./org-model-selection-utils";
import type { GenerativeModelModality } from "./org-model-selection-utils";
import type { WorkflowNodeType } from "./workflow-types";

export const REF_MAX_TEXT_META_KEY = "refMaxText" as const;
export const REF_MAX_IMAGE_FOR_TEXT_META_KEY = "refMaxImage" as const;
export const REF_MAX_VIDEO_FOR_TEXT_META_KEY = "refMaxVideo" as const;
export const REF_MAX_IMAGES_META_KEY = "refMaxImages" as const;
export const REF_MAX_VIDEOS_META_KEY = "refMaxVideos" as const;
export const REF_MAX_AUDIOS_META_KEY = "refMaxAudios" as const;
export const REF_REFERENCE_MODE_META_KEY = "refReferenceMode" as const;

export function parseNonNegativeInt(
  raw: string | undefined,
  fallback: number
): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
}

export function textReferenceMetadataFromRules(
  rules: TextModelParameterRules
): Record<string, string> {
  return {
    [REF_MAX_TEXT_META_KEY]: String(rules.maxTextReferences),
    [REF_MAX_IMAGE_FOR_TEXT_META_KEY]: String(rules.maxImageReferences),
    [REF_MAX_VIDEO_FOR_TEXT_META_KEY]: String(rules.maxVideoReferences),
  };
}

export function imageReferenceMetadataFromRules(
  rules: ImageModelParameterRules
): Record<string, string> {
  return {
    [REF_MAX_IMAGES_META_KEY]: String(rules.maxReferenceImages),
  };
}

export function videoReferenceMetadataFromRules(
  rules: VideoModelParameterRules
): Record<string, string> {
  const normalized = normalizeVideoModelParameterRules(rules);
  const referenceMode = resolveVideoReferenceMode(normalized.generationFields);
  return {
    [REF_MAX_IMAGES_META_KEY]: String(normalized.maxReferenceImages),
    [REF_MAX_VIDEOS_META_KEY]: String(normalized.maxReferenceVideos),
    [REF_MAX_AUDIOS_META_KEY]: String(normalized.maxReferenceAudios),
    [REF_REFERENCE_MODE_META_KEY]: referenceMode,
  };
}

export function generativeReferenceMetadataForModel(
  modality: GenerativeModelModality,
  model: OrgModelBindingRef
): Record<string, string> | undefined {
  switch (modality) {
    case "text":
      return textReferenceMetadataFromRules(
        normalizeTextModelParameterRules(
          (model as { parameterRules: TextModelParameterRules }).parameterRules
        )
      );
    case "image":
      return imageReferenceMetadataFromRules(
        normalizeImageModelParameterRules(
          (model as { parameterRules: ImageModelParameterRules }).parameterRules
        )
      );
    case "video":
      return videoReferenceMetadataFromRules(
        normalizeVideoModelParameterRules(
          (model as { parameterRules: VideoModelParameterRules }).parameterRules
        )
      );
    default:
      return undefined;
  }
}

export function readTextReferenceLimitsFromMetadata(
  metadata: Record<string, string> | undefined,
  fallback: TextModelParameterRules
): Pick<
  TextModelParameterRules,
  "maxTextReferences" | "maxImageReferences" | "maxVideoReferences"
> {
  const meta = metadata ?? {};
  return {
    maxTextReferences: parseNonNegativeInt(
      meta[REF_MAX_TEXT_META_KEY],
      fallback.maxTextReferences
    ),
    maxImageReferences: parseNonNegativeInt(
      meta[REF_MAX_IMAGE_FOR_TEXT_META_KEY],
      fallback.maxImageReferences
    ),
    maxVideoReferences: parseNonNegativeInt(
      meta[REF_MAX_VIDEO_FOR_TEXT_META_KEY],
      fallback.maxVideoReferences
    ),
  };
}

export function readImageReferenceLimitFromMetadata(
  metadata: Record<string, string> | undefined,
  fallback: number
): number {
  return parseNonNegativeInt(metadata?.[REF_MAX_IMAGES_META_KEY], fallback);
}

export function readVideoReferenceLimitsFromMetadata(
  metadata: Record<string, string> | undefined,
  fallback: VideoModelParameterRules
): Pick<
  VideoModelParameterRules,
  "maxReferenceImages" | "maxReferenceVideos" | "maxReferenceAudios"
> {
  const meta = metadata ?? {};
  return {
    maxReferenceImages: parseNonNegativeInt(
      meta[REF_MAX_IMAGES_META_KEY],
      fallback.maxReferenceImages
    ),
    maxReferenceVideos: parseNonNegativeInt(
      meta[REF_MAX_VIDEOS_META_KEY],
      fallback.maxReferenceVideos
    ),
    maxReferenceAudios: parseNonNegativeInt(
      meta[REF_MAX_AUDIOS_META_KEY],
      fallback.maxReferenceAudios
    ),
  };
}

export function readVideoReferenceModeFromMetadata(
  targetNodeData: WorkflowNodeType,
  rules: VideoModelParameterRules
): VideoReferenceMode {
  const raw = targetNodeData.metadata?.[REF_REFERENCE_MODE_META_KEY];
  if (raw === "first_last_frame" || raw === "reference_image") {
    return raw;
  }
  return resolveVideoReferenceMode(
    normalizeVideoModelParameterRules(rules).generationFields
  );
}
