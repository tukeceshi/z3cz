import type {
  EphemeralMediaReference,
  GenerationJobDisplayPhase,
  GenerationJobPendingMedia,
  GenerationJobPersistOwner,
  GenerationJobRecord,
  GenerationJobResultJson,
  GetGenerationJobResponse,
  MediaReference,
} from "@dafthunk/types";
import {
  isEphemeralMediaReference,
  isGenerationJobReadyAtExpired,
  shouldDeferClientPersistToServer,
} from "@dafthunk/types";
import { pollOrgVideoTask } from "./org-video-task";

import type { Bindings } from "../context";
import { createDatabase, type Database } from "../db";
import {
  createGenerationJob,
  extractFinalMediaFromJob,
  extractPendingMediaFromJob,
  getGenerationJob,
  updateGenerationJob,
} from "../db/generation-job-queries";
import { CloudflareAiInterfaceService } from "../runtime/cloudflare-ai-interface-service";
import { resolveAiAudioStorage } from "./ai-audio-storage";
import { resolveAiImageStorage } from "./ai-image-storage";
import { resolveAiVideoStorage } from "./ai-video-storage";
import { assertCloudStorageHealthyForGenerativeMedia } from "./assert-cloud-storage-healthy-for-generative-media";
import { syncGenerationJobInvocation } from "./sync-generation-job-invocation";
import {
  isPersistWorkerPoolActive,
  releaseWorkerPersistJobAssignment,
  shouldFallbackWorkerPersistToApi,
} from "./persist-worker-pool-service";
import {
  assertGenerationJobUploadKeysBelongToOrg,
  GenerationJobUploadValidationError,
  validateGenerationJobUploadMedia,
} from "./validate-generation-job-upload";

function inferVideoMimeType(url: string): string {
  const lower = url.split("?")[0]?.toLowerCase() ?? "";
  if (lower.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

function readPersistOwner(
  job: GenerationJobRecord
): GenerationJobPersistOwner | undefined {
  return job.resultJson?.persistOwner;
}

export function resolveGenerationJobDisplayPhase(
  job: GenerationJobRecord
): GenerationJobDisplayPhase {
  switch (job.status) {
    case "pending":
    case "generating":
      return job.resultJson?.upstreamVideoStatus === "queued"
        ? "queued"
        : "generating";
    case "ready_to_persist":
      return "ready_to_persist";
    case "uploading":
      return readPersistOwner(job) === "server"
        ? "server_persisting"
        : "uploading";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "generating";
  }
}

function shouldServerPersistByTimeout(job: GenerationJobRecord): boolean {
  return (
    job.status === "ready_to_persist" &&
    isGenerationJobReadyAtExpired(job.readyAt)
  );
}

function shouldReleaseClientClaim(job: GenerationJobRecord): boolean {
  return (
    job.status === "uploading" &&
    readPersistOwner(job) === "client" &&
    isGenerationJobReadyAtExpired(job.readyAt)
  );
}

export async function markVideoGenerationJobReadyToPersist(
  db: Database,
  params: {
    readonly job: GenerationJobRecord;
    readonly videoUrl: string;
  }
): Promise<GenerationJobRecord> {
  if (
    params.job.status === "ready_to_persist" ||
    params.job.status === "uploading" ||
    params.job.status === "succeeded"
  ) {
    return params.job;
  }

  const readyAt = new Date().toISOString();
  const resultJson: GenerationJobResultJson = {
    ...(params.job.resultJson ?? {}),
    pendingMedia: [
      {
        sourceUrl: params.videoUrl,
        mimeType: inferVideoMimeType(params.videoUrl),
        mediaKind: "ai-video",
      },
    ],
    upstreamTaskId: params.job.upstreamTaskId ?? undefined,
    aiInterfaceId: params.job.interfaceId,
  };

  return (
    (await updateGenerationJob(db, {
      id: params.job.id,
      organizationId: params.job.organizationId,
      status: "ready_to_persist",
      expectedStatuses: ["generating"],
      readyAt,
      resultJson,
    })) ?? params.job
  );
}

function toGetGenerationJobResponse(
  job: GenerationJobRecord
): GetGenerationJobResponse {
  return {
    job,
    pendingMedia: extractPendingMediaFromJob(job),
    finalMedia: extractFinalMediaFromJob(job),
    displayPhase: resolveGenerationJobDisplayPhase(job),
    deferClientPersistToServer: shouldDeferClientPersistToServer(job),
  };
}

function pendingMediaFromEphemeralMedia(
  media: readonly MediaReference[],
  mediaKind: "ai-image" | "ai-video" | "ai-audio"
): readonly GenerationJobPendingMedia[] {
  return media
    .filter(isEphemeralMediaReference)
    .map((item) => ({
      sourceUrl: item.url,
      mimeType: item.mimeType,
      mediaKind,
    }));
}

async function persistPendingMediaOnServer(
  env: Bindings,
  job: GenerationJobRecord,
  pendingMedia: readonly GenerationJobPendingMedia[]
): Promise<readonly MediaReference[]> {
  const workflowId = job.workflowId?.trim() || "unknown";
  const finalMedia: MediaReference[] = [];

  for (const item of pendingMedia) {
    const response = await fetch(item.sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download generated media (${response.status})`);
    }

    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ??
      item.mimeType;
    const data = new Uint8Array(await response.arrayBuffer());

    if (item.mediaKind === "ai-video") {
      const storageResolution = await resolveAiVideoStorage(env, {
        organizationId: job.organizationId,
        workflowId: job.workflowId ?? undefined,
      });
      if (
        storageResolution.storageMode !== "cloud" ||
        !storageResolution.cloudUpload
      ) {
        throw new Error("Cloud storage is not available for server persist");
      }
      finalMedia.push(
        await storageResolution.cloudUpload.upload({
          workflowId,
          data,
          mimeType,
          objectId: crypto.randomUUID(),
        })
      );
      continue;
    }

    if (item.mediaKind === "ai-audio") {
      const storageResolution = await resolveAiAudioStorage(env, {
        organizationId: job.organizationId,
        workflowId: job.workflowId ?? undefined,
      });
      if (
        storageResolution.storageMode !== "cloud" ||
        !storageResolution.cloudUpload
      ) {
        throw new Error("Cloud storage is not available for server persist");
      }
      finalMedia.push(
        await storageResolution.cloudUpload.upload({
          workflowId,
          data,
          mimeType,
          objectId: crypto.randomUUID(),
        })
      );
      continue;
    }

    const storageResolution = await resolveAiImageStorage(env, {
      organizationId: job.organizationId,
      workflowId: job.workflowId ?? undefined,
    });
    if (
      storageResolution.storageMode !== "cloud" ||
      !storageResolution.cloudUpload
    ) {
      throw new Error("Cloud storage is not available for server persist");
    }
    finalMedia.push(
      await storageResolution.cloudUpload.upload({
        workflowId,
        data,
        mimeType,
        objectId: crypto.randomUUID(),
      })
    );
  }

  return finalMedia;
}

async function pollVideoGenerationJob(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<GenerationJobRecord> {
  if (job.modality !== "video" || !job.upstreamTaskId) {
    return job;
  }

  const service = new CloudflareAiInterfaceService(env);
  const iface = await service.resolveOrgInterface({
    organizationId: job.organizationId,
    interfaceId: job.interfaceId,
  });
  if (!iface) {
    const failed = await updateGenerationJob(db, {
      id: job.id,
      organizationId: job.organizationId,
      status: "failed",
      expectedStatuses: ["generating"],
      failureReason: "Could not resolve AI interface",
    });
    if (failed) {
      await syncGenerationJobInvocation(db, failed);
    }
    return failed ?? job;
  }

  const baseUrl = iface.baseUrl.replace(/\/$/, "");
  const pollResult = await pollOrgVideoTask({
    apiKey: iface.apiKey,
    canonicalId: job.modelCanonicalId,
    baseUrl,
    upstreamTaskId: job.upstreamTaskId,
    videoPollUrl: job.resultJson?.videoPollUrl,
  });

  if (pollResult.status === "failed") {
    const failed = await updateGenerationJob(db, {
      id: job.id,
      organizationId: job.organizationId,
      status: "failed",
      expectedStatuses: ["generating"],
      failureReason: pollResult.error ?? "Video generation failed",
    });
    if (failed) {
      await syncGenerationJobInvocation(db, failed);
    }
    return failed ?? job;
  }

  if (pollResult.status !== "completed" || !pollResult.videoUrl) {
    const upstreamVideoStatus = pollResult.upstreamPhase ?? "running";
    if (job.resultJson?.upstreamVideoStatus === upstreamVideoStatus) {
      return job;
    }
    return (
      (await updateGenerationJob(db, {
        id: job.id,
        organizationId: job.organizationId,
        status: "generating",
        expectedStatuses: ["generating"],
        resultJson: {
          ...(job.resultJson ?? {}),
          upstreamVideoStatus,
        },
      })) ?? job
    );
  }

  const readyAt = new Date().toISOString();
  const previousResult = job.resultJson ?? {};
  const { upstreamVideoStatus: _upstreamVideoStatus, ...restResult } =
    previousResult;
  const resultJson: GenerationJobResultJson = {
    ...restResult,
    pendingMedia: [
      {
        sourceUrl: pollResult.videoUrl,
        mimeType: inferVideoMimeType(pollResult.videoUrl),
        mediaKind: "ai-video",
      },
    ],
    upstreamTaskId: job.upstreamTaskId,
    aiInterfaceId: job.interfaceId,
  };

  return (
    (await updateGenerationJob(db, {
      id: job.id,
      organizationId: job.organizationId,
      status: "ready_to_persist",
      expectedStatuses: ["generating"],
      readyAt,
      resultJson,
    })) ?? job
  );
}

async function completeInlineServerGenerationJobPersist(
  env: Bindings,
  db: Database,
  claimed: GenerationJobRecord,
  pendingMedia: readonly GenerationJobPendingMedia[]
): Promise<GenerationJobRecord> {
  try {
    const finalMedia = await persistPendingMediaOnServer(
      env,
      claimed,
      pendingMedia
    );
    const succeededResultJson: GenerationJobResultJson = {
      ...(claimed.resultJson ?? {}),
      pendingMedia,
      finalMedia,
      persistOwner: "server",
      persistDispatch: "api",
    };
    const succeeded = await updateGenerationJob(db, {
      id: claimed.id,
      organizationId: claimed.organizationId,
      status: "succeeded",
      expectedStatuses: ["uploading"],
      resultJson: succeededResultJson,
    });
    if (succeeded) {
      await syncGenerationJobInvocation(db, succeeded);
      return succeeded;
    }
    return claimed;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Server persist failed";
    const failed = await updateGenerationJob(db, {
      id: claimed.id,
      organizationId: claimed.organizationId,
      status: "failed",
      expectedStatuses: ["uploading"],
      failureReason: message,
    });
    if (failed) {
      await syncGenerationJobInvocation(db, failed);
    }
    return failed ?? claimed;
  }
}

async function runServerGenerationJobPersist(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord,
  options?: { readonly forceInline?: boolean }
): Promise<GenerationJobRecord> {
  const pendingMedia = extractPendingMediaFromJob(job);
  if (!pendingMedia || pendingMedia.length === 0) {
    return job;
  }

  try {
    await assertCloudStorageHealthyForGenerativeMedia(
      env,
      job.organizationId
    );
  } catch {
    const cancelled = await updateGenerationJob(db, {
      id: job.id,
      organizationId: job.organizationId,
      status: "cancelled",
      expectedStatuses: ["ready_to_persist", "uploading"],
      failureReason: "cloud_storage_unhealthy",
      healthReason: "blocked",
    });
    if (cancelled) {
      await syncGenerationJobInvocation(db, cancelled);
    }
    return cancelled ?? job;
  }

  const useWorkerPool =
    !options?.forceInline && (await isPersistWorkerPoolActive(db));

  const resultJson: GenerationJobResultJson = {
    ...(job.resultJson ?? {}),
    persistOwner: "server",
    clientPersistStartedAt: undefined,
    persistDispatch: useWorkerPool ? "worker" : "api",
    ...(useWorkerPool
      ? {
          workerDispatchedAt: new Date().toISOString(),
          persistWorkerId: undefined,
          workerClaimedAt: undefined,
        }
      : {
          persistWorkerId: undefined,
          workerClaimedAt: undefined,
          workerDispatchedAt: undefined,
        }),
  };

  const claimed = await updateGenerationJob(db, {
    id: job.id,
    organizationId: job.organizationId,
    status: "uploading",
    expectedStatuses: ["ready_to_persist", "uploading"],
    resultJson,
  });
  if (!claimed || claimed.status !== "uploading") {
    return (await getGenerationJob(db, job.id, job.organizationId)) ?? job;
  }

  if (useWorkerPool) {
    return claimed;
  }

  return completeInlineServerGenerationJobPersist(
    env,
    db,
    claimed,
    pendingMedia
  );
}

async function maybeFallbackStaleWorkerPersist(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<GenerationJobRecord> {
  if (!shouldFallbackWorkerPersistToApi(job)) {
    return job;
  }

  await releaseWorkerPersistJobAssignment(db, job);

  const resetJson: GenerationJobResultJson = {
    ...(job.resultJson ?? {}),
    persistDispatch: "api",
    persistWorkerId: undefined,
    workerClaimedAt: undefined,
    workerDispatchedAt: undefined,
  };

  const reset = await updateGenerationJob(db, {
    id: job.id,
    organizationId: job.organizationId,
    status: "uploading",
    expectedStatuses: ["uploading"],
    resultJson: resetJson,
  });

  if (!reset) {
    return job;
  }

  return runServerGenerationJobPersist(env, db, reset, { forceInline: true });
}

async function maybeRunServerPersistFallback(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<GenerationJobRecord> {
  if (!shouldServerPersistByTimeout(job)) {
    return job;
  }
  return runServerGenerationJobPersist(env, db, job);
}

async function maybeReleaseStaleClientClaim(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<GenerationJobRecord> {
  if (!shouldReleaseClientClaim(job)) {
    return job;
  }
  return runServerGenerationJobPersist(env, db, job);
}

export async function claimClientGenerationJobUpload(
  env: Bindings,
  organizationId: string,
  jobId: string
): Promise<GetGenerationJobResponse | null> {
  const db = createDatabase(env);
  const job = await getGenerationJob(db, jobId, organizationId);
  if (!job) {
    return null;
  }

  if (
    job.status === "succeeded" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return toGetGenerationJobResponse(job);
  }

  if (job.status === "uploading") {
    return toGetGenerationJobResponse(job);
  }

  if (job.status !== "ready_to_persist") {
    return toGetGenerationJobResponse(job);
  }

  const resultJson: GenerationJobResultJson = {
    ...(job.resultJson ?? {}),
    persistOwner: "client",
    clientPersistStartedAt: new Date().toISOString(),
  };

  const claimed = await updateGenerationJob(db, {
    id: job.id,
    organizationId,
    status: "uploading",
    expectedStatuses: ["ready_to_persist"],
    resultJson,
  });

  return claimed ? toGetGenerationJobResponse(claimed) : null;
}

export async function requestServerGenerationJobPersist(
  env: Bindings,
  organizationId: string,
  jobId: string
): Promise<GetGenerationJobResponse | null> {
  const db = createDatabase(env);
  let job = await getGenerationJob(db, jobId, organizationId);
  if (!job) {
    return null;
  }

  if (
    job.status === "succeeded" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return toGetGenerationJobResponse(job);
  }

  if (job.status === "generating" && job.modality === "video") {
    job = await pollVideoGenerationJob(env, db, job);
  }

  if (job.status !== "ready_to_persist" && job.status !== "uploading") {
    return toGetGenerationJobResponse(job);
  }

  if (
    job.status === "uploading" &&
    readPersistOwner(job) === "server"
  ) {
    return toGetGenerationJobResponse(job);
  }

  const persisted = await runServerGenerationJobPersist(env, db, job);
  return toGetGenerationJobResponse(persisted);
}

export async function refreshGenerationJob(
  env: Bindings,
  organizationId: string,
  jobId: string
): Promise<GetGenerationJobResponse | null> {
  const db = createDatabase(env);
  let job = await getGenerationJob(db, jobId, organizationId);
  if (!job) {
    return null;
  }

  if (job.status === "generating" && job.modality === "video") {
    job = await pollVideoGenerationJob(env, db, job);
  }

  if (job.status === "uploading" && readPersistOwner(job) === "client") {
    job = await maybeReleaseStaleClientClaim(env, db, job);
  }

  if (
    job.status === "uploading" &&
    job.resultJson?.persistDispatch === "worker"
  ) {
    job = await maybeFallbackStaleWorkerPersist(env, db, job);
  }

  if (job.status === "ready_to_persist") {
    job = await maybeRunServerPersistFallback(env, db, job);
  }

  return toGetGenerationJobResponse(job);
}

export async function completeGenerationJobClientUpload(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly jobId: string;
    readonly finalMedia: readonly MediaReference[];
  }
): Promise<GetGenerationJobResponse | null> {
  const db = createDatabase(env);
  const job = await getGenerationJob(db, params.jobId, params.organizationId);
  if (!job) {
    return null;
  }

  if (job.status === "cancelled" || job.status === "failed") {
    return toGetGenerationJobResponse(job);
  }

  if (job.status === "succeeded") {
    return toGetGenerationJobResponse(job);
  }

  if (job.status !== "ready_to_persist" && job.status !== "uploading") {
    return toGetGenerationJobResponse(job);
  }

  if (
    job.status === "uploading" &&
    readPersistOwner(job) === "server"
  ) {
    return toGetGenerationJobResponse(job);
  }

  let validatedFinalMedia: readonly MediaReference[];
  try {
    validatedFinalMedia = validateGenerationJobUploadMedia(job, params.finalMedia);
    await assertGenerationJobUploadKeysBelongToOrg(
      env,
      params.organizationId,
      validatedFinalMedia
    );
  } catch (error) {
    if (error instanceof GenerationJobUploadValidationError) {
      throw error;
    }
    throw error;
  }

  const resultJson: GenerationJobResultJson = {
    ...(job.resultJson ?? {}),
    finalMedia: validatedFinalMedia,
    persistOwner: "client",
  };

  const updated = await updateGenerationJob(db, {
    id: job.id,
    organizationId: params.organizationId,
    status: "succeeded",
    expectedStatuses: ["ready_to_persist", "uploading"],
    resultJson,
  });

  if (updated) {
    await syncGenerationJobInvocation(db, updated);
    return toGetGenerationJobResponse(updated);
  }

  return null;
}

export function buildReadyToPersistJobPayload(params: {
  readonly images: readonly MediaReference[];
  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio";
  readonly aiInterfaceId: string;
  readonly invocationId?: string;
}): {
  readonly readyAt: string;
  readonly resultJson: GenerationJobResultJson;
} {
  const readyAt = new Date().toISOString();
  return {
    readyAt,
    resultJson: {
      pendingMedia: pendingMediaFromEphemeralMedia(
        params.images,
        params.mediaKind
      ),
      aiInterfaceId: params.aiInterfaceId,
      invocationId: params.invocationId,
    },
  };
}

export async function createReadyToPersistImageJob(
  db: Database,
  params: {
    readonly id: string;
    readonly organizationId: string;
    readonly userId?: string | null;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly modelCanonicalId: string;
    readonly interfaceId: string;
    readonly images: readonly EphemeralMediaReference[];
    readonly clientRequestId?: string | null;
    readonly invocationId?: string;
  }
): Promise<GenerationJobRecord> {
  const { readyAt, resultJson } = buildReadyToPersistJobPayload({
    images: params.images,
    mediaKind: "ai-image",
    aiInterfaceId: params.interfaceId,
    invocationId: params.invocationId,
  });

  return createGenerationJob(db, {
    id: params.id,
    organizationId: params.organizationId,
    userId: params.userId,
    workflowId: params.workflowId,
    nodeId: params.nodeId,
    modality: "image",
    status: "ready_to_persist",
    modelCanonicalId: params.modelCanonicalId,
    interfaceId: params.interfaceId,
    readyAt,
    resultJson,
    clientRequestId: params.clientRequestId,
  });
}

export async function createReadyToPersistAudioJob(
  db: Database,
  params: {
    readonly id: string;
    readonly organizationId: string;
    readonly userId?: string | null;
    readonly workflowId?: string | null;
    readonly nodeId?: string | null;
    readonly modelCanonicalId: string;
    readonly interfaceId: string;
    readonly audios: readonly EphemeralMediaReference[];
    readonly clientRequestId?: string | null;
    readonly invocationId?: string;
  }
): Promise<GenerationJobRecord> {
  const { readyAt, resultJson } = buildReadyToPersistJobPayload({
    images: params.audios,
    mediaKind: "ai-audio",
    aiInterfaceId: params.interfaceId,
    invocationId: params.invocationId,
  });

  return createGenerationJob(db, {
    id: params.id,
    organizationId: params.organizationId,
    userId: params.userId,
    workflowId: params.workflowId,
    nodeId: params.nodeId,
    modality: "audio",
    status: "ready_to_persist",
    modelCanonicalId: params.modelCanonicalId,
    interfaceId: params.interfaceId,
    readyAt,
    resultJson,
    clientRequestId: params.clientRequestId,
  });
}

export { GenerationJobUploadValidationError } from "./validate-generation-job-upload";
