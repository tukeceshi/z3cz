import { CLOUD_STORAGE_HEALTH_CHECK_TTL_MS } from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import {
  listOrganizationIdsNeedingCloudStorageHealthRefresh,
} from "../db/cloud-storage-health-queries";
import {
  listGenerationJobsNeedingReconciliation,
  listOrganizationIdsWithActiveGenerationJobs,
} from "../db/generation-job-queries";
import { refreshGenerationJob } from "./generation-job-service";
import { probeOrgCloudStorageHealth } from "./probe-org-cloud-storage-health";

const MAX_JOBS_PER_CRON = 30 as const;
const MAX_HEALTH_ORGS_PER_CRON = 50 as const;

export async function runCloudStorageMaintenanceCron(
  env: Bindings
): Promise<void> {
  const db = createDatabase(env);

  const jobs = await listGenerationJobsNeedingReconciliation(
    db,
    MAX_JOBS_PER_CRON
  );
  for (const job of jobs) {
    try {
      await refreshGenerationJob(env, job.organizationId, job.id);
    } catch (error) {
      console.error(
        `[cloud-storage-cron] Failed to reconcile generation job ${job.id}:`,
        error
      );
    }
  }

  const staleBefore = new Date(
    Date.now() - CLOUD_STORAGE_HEALTH_CHECK_TTL_MS
  );
  const [staleHealthOrgIds, activeJobOrgIds] = await Promise.all([
    listOrganizationIdsNeedingCloudStorageHealthRefresh(db, {
      staleBefore,
      limit: MAX_HEALTH_ORGS_PER_CRON,
    }),
    listOrganizationIdsWithActiveGenerationJobs(db, MAX_HEALTH_ORGS_PER_CRON),
  ]);

  const orgIds = [
    ...new Set([...staleHealthOrgIds, ...activeJobOrgIds]),
  ].slice(0, MAX_HEALTH_ORGS_PER_CRON);

  for (const organizationId of orgIds) {
    try {
      await probeOrgCloudStorageHealth(env, organizationId);
    } catch (error) {
      console.error(
        `[cloud-storage-cron] Failed to refresh health for org ${organizationId}:`,
        error
      );
    }
  }
}
