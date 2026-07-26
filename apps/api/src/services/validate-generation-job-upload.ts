import type {
  GenerationJobPendingMedia,
  GenerationJobRecord,
  MediaReference,
} from "@dafthunk/types";
import { isCloudObjectReference, isMediaReference } from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { extractPendingMediaFromJob } from "../db/generation-job-queries";
import { resolveOrgCloudStorage } from "./resolve-org-cloud-storage";

export class GenerationJobUploadValidationError extends Error {
  readonly code = "invalid_generation_job_upload" as const;

  constructor(message: string) {
    super(message);
    this.name = "GenerationJobUploadValidationError";
  }
}

function mimeMatchesMediaKind(
  mimeType: string,
  mediaKind: GenerationJobPendingMedia["mediaKind"]
): boolean {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mediaKind === "ai-image") {
    return normalized.startsWith("image/");
  }
  if (mediaKind === "ai-audio") {
    return normalized.startsWith("audio/");
  }
  return normalized.startsWith("video/");
}

export function validateGenerationJobUploadMedia(
  job: GenerationJobRecord,
  finalMedia: readonly unknown[]
): readonly MediaReference[] {
  const pendingMedia = extractPendingMediaFromJob(job);
  if (!pendingMedia || pendingMedia.length === 0) {
    throw new GenerationJobUploadValidationError(
      "Generation job has no pending media to complete"
    );
  }

  if (finalMedia.length !== pendingMedia.length) {
    throw new GenerationJobUploadValidationError(
      `Expected ${pendingMedia.length} uploaded object(s), received ${finalMedia.length}`
    );
  }

  const validated: MediaReference[] = [];

  for (let index = 0; index < finalMedia.length; index += 1) {
    const candidate = finalMedia[index];
    if (!isMediaReference(candidate)) {
      throw new GenerationJobUploadValidationError(
        `Uploaded media at index ${index} is not a valid media reference`
      );
    }

    if (!isCloudObjectReference(candidate)) {
      throw new GenerationJobUploadValidationError(
        `Uploaded media at index ${index} must be a Volcano TOS object reference`
      );
    }

    const pending = pendingMedia[index];
    if (!mimeMatchesMediaKind(candidate.mimeType, pending.mediaKind)) {
      throw new GenerationJobUploadValidationError(
        `Uploaded media at index ${index} has incompatible MIME type`
      );
    }

    validated.push(candidate);
  }

  return validated;
}

export async function assertGenerationJobUploadKeysBelongToOrg(
  env: Bindings,
  organizationId: string,
  finalMedia: readonly MediaReference[]
): Promise<void> {
  const db = createDatabase(env);
  const cloud = await resolveOrgCloudStorage(db, organizationId);
  if (!cloud) {
    throw new GenerationJobUploadValidationError(
      "Cloud storage is not configured for this organization"
    );
  }

  const prefix = cloud.tosStorage.prefix.trim();
  const prefixWithSlash = prefix.endsWith("/") ? prefix : `${prefix}/`;

  for (const media of finalMedia) {
    if (!isCloudObjectReference(media)) {
      throw new GenerationJobUploadValidationError(
        "Uploaded media must be stored in Volcano TOS"
      );
    }

    if (
      !media.storageKey.startsWith(prefixWithSlash) &&
      media.storageKey !== prefix
    ) {
      throw new GenerationJobUploadValidationError(
        "Uploaded object key does not belong to this organization"
      );
    }
  }
}
