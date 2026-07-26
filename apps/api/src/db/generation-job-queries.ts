import type {
  GenerationJobModality,
  GenerationJobRecord,
  GenerationJobResultJson,
  GenerationJobStatus,
  MediaReference,
} from "@dafthunk/types";
import { ACTIVE_GENERATION_JOB_STATUSES } from "@dafthunk/types";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "./index";
import { parseJsonColumn } from "./parse-json-column";
import { generationJobs } from "./schema";

function mapGenerationJobRow(
  row: typeof generationJobs.$inferSelect
): GenerationJobRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    workflowId: row.workflowId,
    nodeId: row.nodeId,
    modality: row.modality as GenerationJobModality,
    status: row.status as GenerationJobStatus,
    upstreamTaskId: row.upstreamTaskId,
    modelCanonicalId: row.modelCanonicalId,
    interfaceId: row.interfaceId,
    failureReason: row.failureReason,
    healthReason: row.healthReason,
    readyAt: row.readyAt?.toISOString() ?? null,
    resultJson: parseJsonColumn(row.resultJson),
    clientRequestId: row.clientRequestId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export async function createGenerationJob(
  db: Database,
  params: {
    readonly id: string;
    readonly organizationId: string;
    readonly userId?: string | null;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly modality: GenerationJobModality;
    readonly status?: GenerationJobStatus;
    readonly upstreamTaskId?: string | null;
    readonly modelCanonicalId: string;
    readonly interfaceId: string;
    readonly readyAt?: string | null;
    readonly resultJson?: GenerationJobResultJson | null;
    readonly clientRequestId?: string | null;
  }
): Promise<GenerationJobRecord> {
  const status = params.status ?? "pending";

  await db.insert(generationJobs).values({
    id: params.id,
    organizationId: params.organizationId,
    userId: params.userId ?? null,
    workflowId: params.workflowId ?? null,
    nodeId: params.nodeId ?? null,
    modality: params.modality,
    status,
    upstreamTaskId: params.upstreamTaskId ?? null,
    modelCanonicalId: params.modelCanonicalId,
    interfaceId: params.interfaceId,
    readyAt: params.readyAt ? new Date(params.readyAt) : null,
    resultJson: params.resultJson ?? null,
    clientRequestId: params.clientRequestId ?? null,
  });

  const created = await getGenerationJob(db, params.id, params.organizationId);
  if (!created) {
    throw new Error("Failed to create generation job");
  }
  return created;
}

export async function getGenerationJob(
  db: Database,
  id: string,
  organizationId: string
): Promise<GenerationJobRecord | null> {
  const [row] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.id, id),
        eq(generationJobs.organizationId, organizationId)
      )
    )
    .limit(1);

  return row ? mapGenerationJobRow(row) : null;
}

export async function getGenerationJobById(
  db: Database,
  id: string
): Promise<GenerationJobRecord | null> {
  const [row] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, id))
    .limit(1);

  return row ? mapGenerationJobRow(row) : null;
}

export async function getGenerationJobByClientRequestId(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly clientRequestId: string;
  }
): Promise<GenerationJobRecord | null> {
  const [row] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.organizationId, params.organizationId),
        eq(generationJobs.clientRequestId, params.clientRequestId)
      )
    )
    .limit(1);

  return row ? mapGenerationJobRow(row) : null;
}

export async function findActiveGenerationJobForNode(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly workflowId: string;
    readonly nodeId: string;
    readonly modality: GenerationJobModality;
  }
): Promise<GenerationJobRecord | null> {
  const [row] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.organizationId, params.organizationId),
        eq(generationJobs.workflowId, params.workflowId),
        eq(generationJobs.nodeId, params.nodeId),
        eq(generationJobs.modality, params.modality),
        inArray(generationJobs.status, [...ACTIVE_GENERATION_JOB_STATUSES])
      )
    )
    .limit(1);

  return row ? mapGenerationJobRow(row) : null;
}

export async function getGenerationJobByUpstreamTaskId(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly upstreamTaskId: string;
  }
): Promise<GenerationJobRecord | null> {
  const [row] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.organizationId, params.organizationId),
        eq(generationJobs.upstreamTaskId, params.upstreamTaskId)
      )
    )
    .limit(1);

  return row ? mapGenerationJobRow(row) : null;
}

export async function updateGenerationJob(
  db: Database,
  params: {
    readonly id: string;
    readonly organizationId: string;
    readonly status: GenerationJobStatus;
    readonly expectedStatuses?: readonly GenerationJobStatus[];
    readonly upstreamTaskId?: string | null;
    readonly failureReason?: string | null;
    readonly healthReason?: string | null;
    readonly readyAt?: string | null;
    readonly resultJson?: GenerationJobResultJson | null;
  }
): Promise<GenerationJobRecord | null> {
  const terminal =
    params.status === "succeeded" ||
    params.status === "failed" ||
    params.status === "cancelled";

  const conditions = [
    eq(generationJobs.id, params.id),
    eq(generationJobs.organizationId, params.organizationId),
  ];

  if (params.expectedStatuses && params.expectedStatuses.length > 0) {
    conditions.push(
      inArray(generationJobs.status, [...params.expectedStatuses])
    );
  }

  const result = await db
    .update(generationJobs)
    .set({
      status: params.status,
      ...(params.upstreamTaskId !== undefined
        ? { upstreamTaskId: params.upstreamTaskId }
        : {}),
      ...(params.failureReason !== undefined
        ? { failureReason: params.failureReason }
        : {}),
      ...(params.healthReason !== undefined
        ? { healthReason: params.healthReason }
        : {}),
      ...(params.readyAt !== undefined
        ? { readyAt: params.readyAt ? new Date(params.readyAt) : null }
        : {}),
      ...(params.resultJson !== undefined
        ? { resultJson: params.resultJson }
        : {}),
      completedAt: terminal ? sql`now()` : null,
      updatedAt: sql`now()`,
    })
    .where(and(...conditions))
    .returning({ id: generationJobs.id });

  if (result.length === 0) {
    return getGenerationJob(db, params.id, params.organizationId);
  }

  return getGenerationJob(db, params.id, params.organizationId);
}

export async function updateGenerationJobStatus(
  db: Database,
  params: {
    readonly id: string;
    readonly organizationId: string;
    readonly status: GenerationJobStatus;
    readonly upstreamTaskId?: string | null;
    readonly failureReason?: string | null;
    readonly healthReason?: string | null;
  }
): Promise<GenerationJobRecord | null> {
  return updateGenerationJob(db, params);
}

export async function listActiveGenerationJobs(
  db: Database,
  organizationId: string
): Promise<readonly GenerationJobRecord[]> {
  const rows = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.organizationId, organizationId),
        inArray(generationJobs.status, [...ACTIVE_GENERATION_JOB_STATUSES])
      )
    );

  return rows.map(mapGenerationJobRow);
}

export async function listGenerationJobsNeedingReconciliation(
  db: Database,
  limit: number
): Promise<readonly GenerationJobRecord[]> {
  const rows = await db
    .select()
    .from(generationJobs)
    .where(inArray(generationJobs.status, [...ACTIVE_GENERATION_JOB_STATUSES]))
    .orderBy(asc(generationJobs.updatedAt))
    .limit(limit);

  return rows.map(mapGenerationJobRow);
}

export async function listOrganizationIdsWithActiveGenerationJobs(
  db: Database,
  limit: number
): Promise<readonly string[]> {
  const rows = await db
    .selectDistinct({ organizationId: generationJobs.organizationId })
    .from(generationJobs)
    .where(inArray(generationJobs.status, [...ACTIVE_GENERATION_JOB_STATUSES]))
    .limit(limit);

  return rows.map((row) => row.organizationId);
}

export function extractFinalMediaFromJob(
  job: GenerationJobRecord
): readonly MediaReference[] | undefined {
  return job.resultJson?.finalMedia;
}

export function extractPendingMediaFromJob(
  job: GenerationJobRecord
) {
  return job.resultJson?.pendingMedia;
}
