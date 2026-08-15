import type { GenerationJobRecord } from "@dafthunk/types";

import type { Database } from "../db";
import {
  markMediaResourcesFailed,
  placeholderMimeTypeForModality,
} from "./mark-media-resources-failed";

export async function ensureFailedJobPlaceholderResourcesMarked(
  db: Database,
  job: GenerationJobRecord
): Promise<void> {
  if (job.status !== "failed") {
    return;
  }

  const resourceIds = job.resultJson?.placeholderResourceIds ?? [];
  if (resourceIds.length === 0) {
    return;
  }

  await markMediaResourcesFailed(db, {
    organizationId: job.organizationId,
    resourceIds,
    mimeType: placeholderMimeTypeForModality(job.modality),
  });
}
