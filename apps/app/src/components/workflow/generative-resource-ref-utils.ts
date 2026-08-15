import {
  isResourceIdReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";

export function markResourceRefFailed(
  media: WorkflowMediaValue
): WorkflowMediaValue {
  if (!isResourceIdReference(media)) {
    return media;
  }
  return {
    resourceId: media.resourceId,
    mimeType: media.mimeType,
    contentSha256: media.contentSha256,
    failed: true,
  };
}

export function stripGeneratingFlag(
  media: WorkflowMediaValue
): WorkflowMediaValue {
  if (!isResourceIdReference(media) || !media.generating) {
    return media;
  }
  return {
    resourceId: media.resourceId,
    mimeType: media.mimeType,
    contentSha256: media.contentSha256,
  };
}
