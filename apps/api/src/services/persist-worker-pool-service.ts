import type {
  GenerationJobPendingMedia,
  GenerationJobRecord,
  GenerationJobResultJson,
  MediaReference,
  PersistWorkerPresignUploadItem,
  PersistWorkerPresignUploadSlot,
} from "@dafthunk/types";
import { GENERATION_JOB_WORKER_CLAIM_TIMEOUT_MS } from "@dafthunk/types";
import { and, eq, sql } from "drizzle-orm";

import type { Bindings } from "../context";
import type { Database } from "../db";
import {
  extractPendingMediaFromJob,
  getGenerationJob,
  getGenerationJobById,
  updateGenerationJob,
} from "../db/generation-job-queries";
import {
  decrementPersistWorkerActiveJobs,
  getPersistWorkerPoolSettings,
  hasEnabledPersistWorkers,
  incrementPersistWorkerActiveJobs,
  touchPersistWorkerHeartbeat,
  verifyPersistWorkerSecret,
} from "../db/persist-worker-queries";
import { generationJobs } from "../db/schema";
import { syncGenerationJobInvocation } from "./sync-generation-job-invocation";
import { presignTosMediaUpload } from "./tos-media-presign";
import {
  assertGenerationJobUploadKeysBelongToOrg,
  validateGenerationJobUploadMedia,
} from "./validate-generation-job-upload";

export function shouldFallbackWorkerPersistToApi(
  job: GenerationJobRecord,
  nowMs: number = Date.now()
): boolean {
  if (job.status !== "uploading") {
    return false;
  }
  if (job.resultJson?.persistOwner !== "server") {
    return false;
  }
  if (job.resultJson?.persistDispatch !== "worker") {
    return false;
  }

  const anchor =
    job.resultJson.workerClaimedAt ?? job.resultJson.workerDispatchedAt;
  if (!anchor) {
    return false;
  }

  return (
    Date.parse(anchor) + GENERATION_JOB_WORKER_CLAIM_TIMEOUT_MS <= nowMs
  );
}

export async function isPersistWorkerPoolActive(
  db: Database
): Promise<boolean> {
  const settings = await getPersistWorkerPoolSettings(db);
  if (!settings.enabled) {
    return false;
  }
  return hasEnabledPersistWorkers(db);
}

interface ClaimableJobRow {
  readonly id: string;
  readonly organization_id: string;
  readonly result_json: GenerationJobResultJson | null;
}

export async function claimPersistJobForWorker(
  db: Database,
  workerId: string,
  secret: string
): Promise<{
  readonly job: GenerationJobRecord;
  readonly pendingMedia: readonly GenerationJobPendingMedia[];
} | null> {
  const worker = await verifyPersistWorkerSecret(db, workerId, secret);
  if (!worker) {
    return null;
  }

  await touchPersistWorkerHeartbeat(db, workerId);

  const incremented = await incrementPersistWorkerActiveJobs(db, workerId);
  if (!incremented) {
    return null;
  }

  try {
    const claimed = await db.transaction(async (tx) => {
      const rows = (await tx.execute(sql`
        SELECT id, organization_id, result_json
        FROM generation_jobs
        WHERE status = 'uploading'
          AND result_json->>'persistOwner' = 'server'
          AND result_json->>'persistDispatch' = 'worker'
          AND (
            result_json->>'persistWorkerId' IS NULL
            OR COALESCE(
              (result_json->>'workerClaimedAt')::timestamptz,
              (result_json->>'workerDispatchedAt')::timestamptz,
              updated_at
            ) <= now() - (${GENERATION_JOB_WORKER_CLAIM_TIMEOUT_MS} * interval '1 millisecond')
          )
        ORDER BY ready_at ASC NULLS LAST, updated_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `)) as ClaimableJobRow[];

      const candidate = rows[0];
      if (!candidate) {
        return null;
      }

      const previousWorkerId = candidate.result_json?.persistWorkerId;
      if (previousWorkerId && previousWorkerId !== workerId) {
        await decrementPersistWorkerActiveJobs(tx, previousWorkerId);
      }

      const workerClaimedAt = new Date().toISOString();
      const resultJson: GenerationJobResultJson = {
        ...(candidate.result_json ?? {}),
        persistWorkerId: workerId,
        workerClaimedAt,
      };

      const [updated] = await tx
        .update(generationJobs)
        .set({
          resultJson,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(generationJobs.id, candidate.id),
            eq(generationJobs.organizationId, candidate.organization_id),
            eq(generationJobs.status, "uploading")
          )
        )
        .returning({ id: generationJobs.id });

      if (!updated) {
        return null;
      }

      return getGenerationJob(tx, candidate.id, candidate.organization_id);
    });

    if (!claimed) {
      await decrementPersistWorkerActiveJobs(db, workerId);
      return null;
    }

    const pendingMedia = extractPendingMediaFromJob(claimed);
    if (!pendingMedia || pendingMedia.length === 0) {
      await decrementPersistWorkerActiveJobs(db, workerId);
      return null;
    }

    return { job: claimed, pendingMedia };
  } catch (error) {
    await decrementPersistWorkerActiveJobs(db, workerId);
    throw error;
  }
}

export async function presignPersistJobUploadsForWorker(
  env: Bindings,
  db: Database,
  params: {
    readonly workerId: string;
    readonly secret: string;
    readonly jobId: string;
    readonly items: readonly PersistWorkerPresignUploadItem[];
  }
): Promise<readonly PersistWorkerPresignUploadSlot[] | null> {
  const worker = await verifyPersistWorkerSecret(
    db,
    params.workerId,
    params.secret
  );
  if (!worker) {
    return null;
  }

  const mapped = await getGenerationJobById(db, params.jobId);
  if (!mapped) {
    return null;
  }

  if (
    mapped.status !== "uploading" ||
    mapped.resultJson?.persistDispatch !== "worker" ||
    mapped.resultJson.persistWorkerId !== params.workerId
  ) {
    return null;
  }

  const pendingMedia = extractPendingMediaFromJob(mapped);
  if (!pendingMedia) {
    return null;
  }

  const slots: PersistWorkerPresignUploadSlot[] = [];

  for (const item of params.items) {
    const pending = pendingMedia[item.index];
    if (!pending) {
      return null;
    }

    const presigned = await presignTosMediaUpload(env, {
      organizationId: mapped.organizationId,
      workflowId: mapped.workflowId ?? undefined,
      mimeType: item.mimeType || pending.mimeType,
      contentLength: item.contentLength,
      mediaKind: pending.mediaKind,
    });

    if (!presigned) {
      return null;
    }

    slots.push({
      index: item.index,
      uploadUrl: presigned.uploadUrl,
      uploadHeaders: presigned.uploadHeaders,
      reference: presigned.reference,
    });
  }

  return slots;
}

export async function completePersistJobFromWorker(
  env: Bindings,
  db: Database,
  params: {
    readonly workerId: string;
    readonly secret: string;
    readonly jobId: string;
    readonly finalMedia: readonly MediaReference[];
  }
): Promise<GenerationJobRecord | null> {
  const worker = await verifyPersistWorkerSecret(
    db,
    params.workerId,
    params.secret
  );
  if (!worker) {
    return null;
  }

  const mapped = await getGenerationJobById(db, params.jobId);
  if (!mapped) {
    return null;
  }

  if (
    mapped.status !== "uploading" ||
    mapped.resultJson?.persistDispatch !== "worker" ||
    mapped.resultJson.persistWorkerId !== params.workerId
  ) {
    return null;
  }

  let validatedFinalMedia: readonly MediaReference[];
  try {
    validatedFinalMedia = validateGenerationJobUploadMedia(
      mapped,
      params.finalMedia
    );
    await assertGenerationJobUploadKeysBelongToOrg(
      env,
      mapped.organizationId,
      validatedFinalMedia
    );
  } catch {
    return null;
  }

  const pendingMedia = extractPendingMediaFromJob(mapped);
  const succeededResultJson: GenerationJobResultJson = {
    ...(mapped.resultJson ?? {}),
    pendingMedia: pendingMedia ?? undefined,
    finalMedia: validatedFinalMedia,
    persistOwner: "server",
    persistDispatch: "worker",
  };

  const succeeded = await updateGenerationJob(db, {
    id: mapped.id,
    organizationId: mapped.organizationId,
    status: "succeeded",
    expectedStatuses: ["uploading"],
    resultJson: succeededResultJson,
  });

  if (succeeded) {
    await decrementPersistWorkerActiveJobs(db, params.workerId);
    await syncGenerationJobInvocation(db, succeeded);
    return succeeded;
  }

  return null;
}

export async function failPersistJobFromWorker(
  db: Database,
  params: {
    readonly workerId: string;
    readonly secret: string;
    readonly jobId: string;
    readonly reason: string;
  }
): Promise<GenerationJobRecord | null> {
  const worker = await verifyPersistWorkerSecret(
    db,
    params.workerId,
    params.secret
  );
  if (!worker) {
    return null;
  }

  const mapped = await getGenerationJobById(db, params.jobId);
  if (!mapped) {
    return null;
  }

  if (
    mapped.status !== "uploading" ||
    mapped.resultJson?.persistDispatch !== "worker" ||
    mapped.resultJson.persistWorkerId !== params.workerId
  ) {
    return null;
  }

  const failed = await updateGenerationJob(db, {
    id: mapped.id,
    organizationId: mapped.organizationId,
    status: "failed",
    expectedStatuses: ["uploading"],
    failureReason: params.reason.trim() || "Worker persist failed",
  });

  if (failed) {
    await decrementPersistWorkerActiveJobs(db, params.workerId);
    await syncGenerationJobInvocation(db, failed);
    return failed;
  }

  return null;
}

export async function releaseWorkerPersistJobAssignment(
  db: Database,
  job: GenerationJobRecord
): Promise<void> {
  const workerId = job.resultJson?.persistWorkerId;
  if (workerId) {
    await decrementPersistWorkerActiveJobs(db, workerId);
  }
}

export { getPersistWorkerPoolSettings };
