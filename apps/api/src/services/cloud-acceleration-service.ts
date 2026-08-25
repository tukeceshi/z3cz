import type {
  AiInterfaceCloudAccelerationEntry,
  GenerationJobModality,
  GenerationJobRecord,
} from "@dafthunk/types";

import type { Database } from "../db";
import {
  disableAiInterfaceCloudAcceleration,
  enableAlwaysAiInterfaceCloudAcceleration,
  isAiInterfaceCloudAccelerationActive,
  listActiveAiInterfaceCloudAccelerations,
  resourceIdsFromPendingMedia,
  updateMediaResourceCloudAccelerationStatus,
} from "../db/cloud-acceleration-queries";
import { extractPendingMediaFromJob } from "../db/generation-job-queries";

export async function listOrgAiInterfaceCloudAccelerations(
  db: Database,
  organizationId: string
): Promise<readonly AiInterfaceCloudAccelerationEntry[]> {
  return listActiveAiInterfaceCloudAccelerations(db, organizationId);
}

export async function disableOrgAiInterfaceCloudAcceleration(
  db: Database,
  organizationId: string,
  aiInterfaceId: string
): Promise<boolean> {
  return disableAiInterfaceCloudAcceleration(db, organizationId, aiInterfaceId);
}

export async function enableOrgAlwaysAiInterfaceCloudAcceleration(
  db: Database,
  organizationId: string,
  aiInterfaceId: string
): Promise<AiInterfaceCloudAccelerationEntry | null> {
  return enableAlwaysAiInterfaceCloudAcceleration(db, {
    organizationId,
    aiInterfaceId,
  });
}

function isCloudAccelerationModality(modality: GenerationJobModality): boolean {
  return modality === "image" || modality === "video";
}

export async function resolveJobCloudAccelerationFlags(
  db: Database,
  job: GenerationJobRecord
): Promise<{
  readonly cloudAccelerationEnabled: boolean;
  readonly shouldUseCloudAcceleration: boolean;
}> {
  if (!isCloudAccelerationModality(job.modality)) {
    return {
      cloudAccelerationEnabled: false,
      shouldUseCloudAcceleration: false,
    };
  }

  const shouldUseCloudAcceleration =
    await isAiInterfaceCloudAccelerationActive(
      db,
      job.organizationId,
      job.interfaceId
    );

  return {
    cloudAccelerationEnabled: true,
    shouldUseCloudAcceleration,
  };
}

export async function markJobResourcesCloudAccelerationStatus(
  db: Database,
  job: GenerationJobRecord,
  status: "pending" | "active" | "done" | "failed" | null
): Promise<void> {
  const pendingMedia = extractPendingMediaFromJob(job) ?? [];
  const resourceIds = resourceIdsFromPendingMedia(
    pendingMedia,
    job.resultJson?.placeholderResourceIds
  );
  await updateMediaResourceCloudAccelerationStatus(db, {
    organizationId: job.organizationId,
    resourceIds,
    status,
  });
}

export async function shouldAutoCloudAccelerateJob(
  db: Database,
  job: GenerationJobRecord
): Promise<boolean> {
  const flags = await resolveJobCloudAccelerationFlags(db, job);
  return flags.shouldUseCloudAcceleration;
}
