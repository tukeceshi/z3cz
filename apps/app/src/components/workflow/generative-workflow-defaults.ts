import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  type WorkflowGenerativeDefaultEntry,
  type WorkflowGenerativeDefaults,
} from "@dafthunk/types";

import type { GenerativeModelModality } from "./org-model-selection-utils";

export function generativeModalityForNodeType(
  nodeType: string | undefined
): GenerativeModelModality | undefined {
  switch (nodeType) {
    case AI_TEXT_NODE_TYPE:
      return "text";
    case AI_IMAGE_NODE_TYPE:
      return "image";
    case AI_VIDEO_NODE_TYPE:
      return "video";
    case AI_AUDIO_NODE_TYPE:
      return "audio";
    default:
      return undefined;
  }
}

export function readWorkflowGenerativeDefault(
  defaults: WorkflowGenerativeDefaults | undefined,
  modality: GenerativeModelModality
): WorkflowGenerativeDefaultEntry | undefined {
  const entry = defaults?.[modality];
  if (!entry) {
    return undefined;
  }
  const canonicalId = entry.canonicalId.trim();
  const interfaceId = entry.interfaceId.trim();
  if (!canonicalId || !interfaceId) {
    return undefined;
  }
  return {
    canonicalId,
    interfaceId,
    ...(entry.params !== undefined ? { params: entry.params } : {}),
  };
}

export function writeWorkflowGenerativeDefault(
  defaults: WorkflowGenerativeDefaults | undefined,
  modality: GenerativeModelModality,
  entry: WorkflowGenerativeDefaultEntry
): WorkflowGenerativeDefaults {
  return {
    ...(defaults ?? {}),
    [modality]: {
      canonicalId: entry.canonicalId,
      interfaceId: entry.interfaceId,
      ...(entry.params !== undefined ? { params: entry.params } : {}),
    },
  };
}
