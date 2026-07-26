import type {
  CloudStorageHealthSnapshot,
  CloudStorageHealthStatus,
} from "@dafthunk/types";

import type { Database } from "../db";
import {
  generationJobs,
  organizationCloudStorageHealth,
} from "../db/schema";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";

import { ACTIVE_GENERATION_JOB_STATUSES } from "@dafthunk/types";

function mapHealthRow(
  row: typeof organizationCloudStorageHealth.$inferSelect
): CloudStorageHealthSnapshot {
  return {
    status: row.status as CloudStorageHealthStatus,
    reason: (row.reason as CloudStorageHealthSnapshot["reason"]) ?? null,
    message: row.message,
    checkedAt: row.checkedAt.toISOString(),
    interfaceId: row.interfaceId,
    bucket: row.bucket,
    region: row.region,
    consecutiveFailureCount: row.consecutiveFailureCount,
  };
}

export async function getOrganizationCloudStorageHealth(
  db: Database,
  organizationId: string
): Promise<CloudStorageHealthSnapshot | null> {
  const [row] = await db
    .select()
    .from(organizationCloudStorageHealth)
    .where(eq(organizationCloudStorageHealth.organizationId, organizationId))
    .limit(1);

  return row ? mapHealthRow(row) : null;
}

export async function upsertOrganizationCloudStorageHealth(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly snapshot: CloudStorageHealthSnapshot;
  }
): Promise<CloudStorageHealthSnapshot> {
  const previous = await getOrganizationCloudStorageHealth(
    db,
    params.organizationId
  );

  await db
    .insert(organizationCloudStorageHealth)
    .values({
      organizationId: params.organizationId,
      interfaceId: params.snapshot.interfaceId,
      status: params.snapshot.status,
      reason: params.snapshot.reason,
      message: params.snapshot.message,
      bucket: params.snapshot.bucket,
      region: params.snapshot.region,
      consecutiveFailureCount: params.snapshot.consecutiveFailureCount ?? 0,
      checkedAt: new Date(params.snapshot.checkedAt),
    })
    .onConflictDoUpdate({
      target: organizationCloudStorageHealth.organizationId,
      set: {
        interfaceId: params.snapshot.interfaceId,
        status: params.snapshot.status,
        reason: params.snapshot.reason,
        message: params.snapshot.message,
        bucket: params.snapshot.bucket,
        region: params.snapshot.region,
        consecutiveFailureCount: params.snapshot.consecutiveFailureCount ?? 0,
        checkedAt: new Date(params.snapshot.checkedAt),
      },
    });

  if (
    params.snapshot.status === "blocked" &&
    previous?.status !== "blocked"
  ) {
    await cancelActiveGenerationJobsForStorageHealth(db, {
      organizationId: params.organizationId,
      healthReason: params.snapshot.reason ?? "blocked",
    });
  }

  return params.snapshot;
}

export async function cancelActiveGenerationJobsForStorageHealth(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly healthReason: string;
  }
): Promise<number> {
  const result = await db
    .update(generationJobs)
    .set({
      status: "cancelled",
      healthReason: params.healthReason,
      failureReason: "cloud_storage_unhealthy",
      completedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(generationJobs.organizationId, params.organizationId),
        inArray(generationJobs.status, [...ACTIVE_GENERATION_JOB_STATUSES])
      )
    )
    .returning({ id: generationJobs.id });

  return result.length;
}

export async function listOrganizationIdsNeedingCloudStorageHealthRefresh(
  db: Database,
  params: {
    readonly staleBefore: Date;
    readonly limit: number;
  }
): Promise<readonly string[]> {
  const rows = await db
    .select({ organizationId: organizationCloudStorageHealth.organizationId })
    .from(organizationCloudStorageHealth)
    .where(
      or(
        lt(organizationCloudStorageHealth.checkedAt, params.staleBefore),
        eq(organizationCloudStorageHealth.status, "degraded"),
        eq(organizationCloudStorageHealth.status, "blocked")
      )
    )
    .limit(params.limit);

  return [...new Set(rows.map((row) => row.organizationId))];
}
