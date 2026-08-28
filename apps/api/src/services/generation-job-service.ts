import type {
  CancelGenerationJobResponse,
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
  buildVideoPollUrl,
  isEphemeralMediaReference,
  isGenerationJobReadyAtExpired,
  isGrokImagineVideoCanonicalId,
  isVeoCanonicalId,
  isVideoUpstreamPollDue,
  createEphemeralMediaExpiresAt,
  mediaReferenceToWorkflowValue,
  nextVideoUpstreamPollAt,
  resolveOfficialVideoEndpoints,
  resolveVideoCancelBranch,
  shouldDeferClientPersistToServer,
  type ResourceIdReference,
} from "@dafthunk/types";
import { pollOrgVideoTask, cancelOrgVideoTask } from "./org-video-task";
import { createJobUpstreamRequestLogger } from "./job-upstream-request-logger";
import { fetchWithUpstreamLog } from "@dafthunk/runtime/ai-interface/upstream-request-log";

import type { Bindings } from "../context";
import { createDatabase, type Database } from "../db";
import {
  createGenerationJob,
  extractFinalMediaFromJob,
  extractPendingMediaFromJob,
  getGenerationJob,
  getGenerationJobByClientRequestId,
  updateGenerationJob,
} from "../db/generation-job-queries";
import { upsertMediaResources } from "../db/media-resource-queries";
import { CloudflareAiInterfaceService } from "../runtime/cloudflare-ai-interface-service";
import { resolveAiAudioStorage } from "./ai-audio-storage";
import { resolveAiImageStorage } from "./ai-image-storage";
import { resolveAiVideoStorage } from "./ai-video-storage";
import { assertCloudStorageHealthyForGenerativeMedia } from "./assert-cloud-storage-healthy-for-generative-media";
import { syncGenerationJobInvocation } from "./sync-generation-job-invocation";
import { ensureFailedJobPlaceholderResourcesMarked } from "./ensure-failed-job-placeholder-resources";
import { markMediaResourcesFailed, placeholderMimeTypeForModality } from "./mark-media-resources-failed";
import {
  registerMediaResourceTransitions,
  registerMediaResourcesFromReferences,
  type MediaResourceTransition,
} from "./media-resource-catalog-service";
import {
  persistJobCloudAccelerationStatus,
  persistJobCancellingNodeContent,
  persistJobFinalizedGeneratingContent,
} from "./persist-generating-node-content";
import {
  markJobResourcesCloudAccelerationStatus,
  resolveJobCloudAccelerationFlags,
} from "./cloud-acceleration-service";
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
import { writeGenerationJobCancelLog } from "./write-generation-job-cancel-log";
import { pollVideoEnhanceGenerationJob } from "./video-enhance-service";
import { pollVideoTrimGenerationJob } from "./video-trim-service";

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

async function syncJobCloudAccelerationToWorkflow(
  env: Bindings,
  job: GenerationJobRecord,
  status: "pending" | "active"
): Promise<void> {
  const pendingMedia = extractPendingMediaFromJob(job) ?? [];
  try {
    await persistJobCloudAccelerationStatus(env, job, pendingMedia, status);
  } catch {
    // Node JSON sync is best-effort; catalog status remains authoritative.
  }
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
    case "cancelling":
      return "cancelling";
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
      buildVideoPendingMedia(params.job, params.videoUrl),
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

function toWorkflowFinalMedia(
  media: readonly MediaReference[] | undefined
): readonly ResourceIdReference[] | undefined {
  if (!media || media.length === 0) {
    return undefined;
  }
  return media.map((ref) => mediaReferenceToWorkflowValue(ref));
}

async function toGetGenerationJobResponse(
  db: Database,
  job: GenerationJobRecord
): Promise<GetGenerationJobResponse> {
  const cloudAccel = await resolveJobCloudAccelerationFlags(db, job);
  return {
    job,
    pendingMedia: extractPendingMediaFromJob(job),
    finalMedia: toWorkflowFinalMedia(extractFinalMediaFromJob(job)),
    displayPhase: resolveGenerationJobDisplayPhase(job),
    deferClientPersistToServer: shouldDeferClientPersistToServer(job),
    cloudAccelerationEnabled: cloudAccel.cloudAccelerationEnabled,
    shouldUseCloudAcceleration: cloudAccel.shouldUseCloudAcceleration,
  };
}

export function persistObjectIdForPendingMedia(
  item: Pick<GenerationJobPendingMedia, "resourceId">
): string {
  const resourceId = item.resourceId?.trim();
  return resourceId ? resourceId : crypto.randomUUID();
}

export function buildVideoPendingMedia(
  job: Pick<GenerationJobRecord, "resultJson">,
  videoUrl: string
): GenerationJobPendingMedia {
  const resourceId = job.resultJson?.placeholderResourceIds?.[0];
  return {
    sourceUrl: videoUrl,
    mimeType: inferVideoMimeType(videoUrl),
    mediaKind: "ai-video",
    ...(resourceId ? { resourceId } : {}),
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
      resourceId: item.mediaId,
    }));
}

function buildMediaResourceTransitionsFromJobComplete(
  pendingMedia: readonly GenerationJobPendingMedia[],
  finalMedia: readonly MediaReference[]
): readonly MediaResourceTransition[] {
  return finalMedia.map((reference, index) => ({
    fromResourceId: pendingMedia[index]?.resourceId,
    reference,
  }));
}

async function persistPendingMediaOnServer(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord,
  pendingMedia: readonly GenerationJobPendingMedia[]
): Promise<readonly MediaReference[]> {
  const workflowId = job.workflowId?.trim() || "unknown";
  const finalMedia: MediaReference[] = [];
  const downloadLog = createJobUpstreamRequestLogger(db, job, "download");

  for (const item of pendingMedia) {
    const response = await fetchWithUpstreamLog(
      item.sourceUrl,
      { method: "GET" },
      downloadLog,
      { responseMode: "stream" }
    );
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
          objectId: persistObjectIdForPendingMedia(item),
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
          objectId: persistObjectIdForPendingMedia(item),
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
        objectId: persistObjectIdForPendingMedia(item),
      })
    );
  }

  return finalMedia;
}

async function toCancelGenerationJobResponse(
  db: Database,
  job: GenerationJobRecord,
  extras?: {
    readonly cancelPending?: boolean;
    readonly cancelFailed?: boolean;
  }
): Promise<CancelGenerationJobResponse> {
  return {
    ...(await toGetGenerationJobResponse(db, job)),
    cancelled: job.status === "cancelled",
    ...(extras?.cancelPending ? { cancelPending: true } : {}),
    ...(extras?.cancelFailed
      ? {
          cancelFailed: true,
          upstreamCancelFailed: true,
        }
      : {}),
  };
}

async function syncJobCancellingToWorkflow(
  env: Bindings,
  job: GenerationJobRecord,
  cancelling: boolean
): Promise<void> {
  await persistJobCancellingNodeContent(env, job, cancelling);
}

async function enterVideoDeferredCancel(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<CancelGenerationJobResponse> {
  if (job.status === "cancelling") {
    await syncJobCancellingToWorkflow(env, job, true);
    return toCancelGenerationJobResponse(db, job, { cancelPending: true });
  }

  const cancelling = await updateGenerationJob(db, {
    id: job.id,
    organizationId: job.organizationId,
    status: "cancelling",
    expectedStatuses: ["pending", "generating"],
    failureReason: "Generation cancel in progress",
  });

  if (cancelling) {
    await syncJobCancellingToWorkflow(env, cancelling, true);
    return toCancelGenerationJobResponse(db, cancelling, { cancelPending: true });
  }

  const latest = await getGenerationJob(db, job.id, job.organizationId);
  return toCancelGenerationJobResponse(db, latest ?? job);
}

async function finalizeJobCancelled(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<GenerationJobRecord | null> {
  const cancelled = await updateGenerationJob(db, {
    id: job.id,
    organizationId: job.organizationId,
    status: "cancelled",
    expectedStatuses: ["pending", "generating", "cancelling"],
    failureReason: "Generation cancelled",
  });

  if (!cancelled) {
    return getGenerationJob(db, job.id, job.organizationId);
  }

  await markMediaResourcesFailed(db, {
    organizationId: cancelled.organizationId,
    resourceIds: cancelled.resultJson?.placeholderResourceIds ?? [],
    mimeType: placeholderMimeTypeForModality(cancelled.modality),
  });
  await syncJobCancellingToWorkflow(env, cancelled, false);
  await syncGenerationJobInvocation(db, cancelled);
  await writeGenerationJobCancelLog(db, cancelled);
  return cancelled;
}

async function revertVideoCancelToGenerating(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<GenerationJobRecord> {
  const reverted =
    (await updateGenerationJob(db, {
      id: job.id,
      organizationId: job.organizationId,
      status: "generating",
      expectedStatuses: ["cancelling"],
      failureReason: null,
    })) ?? job;

  if (reverted.status === "generating") {
    await syncJobCancellingToWorkflow(env, reverted, false);
  }

  return reverted;
}

async function tryCancelUpstreamVideoTask(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<{
  readonly deleted: boolean;
  readonly skipped: boolean;
}> {
  if (
    job.modality !== "video" ||
    !job.upstreamTaskId ||
    isGrokImagineVideoCanonicalId(job.modelCanonicalId) ||
    isVeoCanonicalId(job.modelCanonicalId)
  ) {
    return { deleted: false, skipped: true };
  }

  const service = new CloudflareAiInterfaceService(env);
  const iface = await service.resolveOrgInterface({
    organizationId: job.organizationId,
    interfaceId: job.interfaceId,
    modelCanonicalId: job.modelCanonicalId,
  });
  if (!iface) {
    return { deleted: false, skipped: true };
  }

  const videoEndpoints =
    iface.videoEndpoints ?? resolveOfficialVideoEndpoints();
  if (!videoEndpoints.supportsTaskCancel) {
    return { deleted: false, skipped: true };
  }

  const pollUrl =
    job.resultJson?.videoPollUrl ??
    buildVideoPollUrl({
      baseUrl: iface.baseUrl,
      submitPath: videoEndpoints.submitPath,
      taskId: job.upstreamTaskId,
      useFullSubmitUrl: videoEndpoints.useFullSubmitUrl,
    });

  const result = await cancelOrgVideoTask({
    apiKey: iface.apiKey,
    canonicalId: job.modelCanonicalId,
    pollUrl,
    baseUrl: iface.baseUrl,
    upstreamTaskId: job.upstreamTaskId,
    videoEndpoints,
    upstreamLog: createJobUpstreamRequestLogger(db, job, "cancel"),
  });

  if (result.status === "skipped") {
    return { deleted: false, skipped: true };
  }
  if (result.status === "failed") {
    return { deleted: false, skipped: false };
  }
  return { deleted: true, skipped: false };
}

async function cancelNonVideoGenerationJob(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<CancelGenerationJobResponse> {
  if (job.status !== "pending" && job.status !== "generating") {
    return toCancelGenerationJobResponse(db, job);
  }

  const cancelled = await finalizeJobCancelled(env, db, job);
  if (cancelled?.status === "cancelled") {
    return toCancelGenerationJobResponse(db, cancelled);
  }

  const latest = await getGenerationJob(db, job.id, job.organizationId);
  return toCancelGenerationJobResponse(db, latest ?? job);
}

async function cancelVideoGenerationJob(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<CancelGenerationJobResponse> {
  const branch = resolveVideoCancelBranch({
    jobStatus: job.status,
    upstreamVideoStatus: job.resultJson?.upstreamVideoStatus,
  });

  if (branch === "already_cancelled") {
    return toCancelGenerationJobResponse(db, job);
  }

  if (branch === "already_cancelling") {
    await syncJobCancellingToWorkflow(env, job, true);
    return toCancelGenerationJobResponse(db, job, { cancelPending: true });
  }

  if (branch === "blocked") {
    return toCancelGenerationJobResponse(db, job);
  }

  if (branch === "delete_now") {
    const upstream = await tryCancelUpstreamVideoTask(env, db, job);
    if (!upstream.deleted) {
      return enterVideoDeferredCancel(env, db, job);
    }

    const cancelled = await finalizeJobCancelled(env, db, job);
    if (cancelled?.status === "cancelled") {
      return toCancelGenerationJobResponse(db, cancelled);
    }

    const latest = await getGenerationJob(db, job.id, job.organizationId);
    return toCancelGenerationJobResponse(db, latest ?? job);
  }

  return enterVideoDeferredCancel(env, db, job);
}

async function cancelGenerationJobRecord(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<CancelGenerationJobResponse> {
  if (job.modality === "video" && job.upstreamTaskId) {
    return cancelVideoGenerationJob(env, db, job);
  }

  return cancelNonVideoGenerationJob(env, db, job);
}

export async function pollVideoGenerationJob(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<GenerationJobRecord> {
  if (job.resultJson?.jobKind === "video_enhance") {
    return pollVideoEnhanceGenerationJob(env, db, job);
  }

  if (job.resultJson?.jobKind === "video_trim") {
    return pollVideoTrimGenerationJob(env, db, job);
  }

  if (job.modality !== "video" || !job.upstreamTaskId) {
    return job;
  }

  if (job.status === "cancelled" || job.status === "failed") {
    return job;
  }

  if (!isVideoUpstreamPollDue(job.resultJson)) {
    return job;
  }

  const service = new CloudflareAiInterfaceService(env);
  const iface = await service.resolveOrgInterface({
    organizationId: job.organizationId,
    interfaceId: job.interfaceId,
    modelCanonicalId: job.modelCanonicalId,
  });
  if (!iface) {
    const expectedStatuses =
      job.status === "cancelling" ? (["cancelling"] as const) : (["generating"] as const);
    const failed = await updateGenerationJob(db, {
      id: job.id,
      organizationId: job.organizationId,
      status: "failed",
      expectedStatuses: [...expectedStatuses],
      failureReason: "Could not resolve AI interface",
    });
    if (failed) {
      await markMediaResourcesFailed(db, {
        organizationId: failed.organizationId,
        resourceIds: failed.resultJson?.placeholderResourceIds ?? [],
        mimeType: placeholderMimeTypeForModality(failed.modality),
      });
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
    videoEndpoints: iface.videoEndpoints,
    formatTransform: iface.formatTransform,
    upstreamLog: createJobUpstreamRequestLogger(db, job, "poll"),
  });

  const activeStatuses =
    job.status === "cancelling"
      ? (["cancelling"] as const)
      : (["generating"] as const);

  if (pollResult.status === "failed") {
    const failed = await updateGenerationJob(db, {
      id: job.id,
      organizationId: job.organizationId,
      status: "failed",
      expectedStatuses: [...activeStatuses],
      failureReason: pollResult.error ?? "Video generation failed",
    });
    if (failed) {
      await markMediaResourcesFailed(db, {
        organizationId: failed.organizationId,
        resourceIds: failed.resultJson?.placeholderResourceIds ?? [],
        mimeType: placeholderMimeTypeForModality(failed.modality),
      });
      await syncGenerationJobInvocation(db, failed);
    }
    return failed ?? job;
  }

  if (pollResult.status !== "completed" || !pollResult.videoUrl) {
    const upstreamVideoStatus = pollResult.upstreamPhase ?? "running";

    if (job.status === "cancelling") {
      if (upstreamVideoStatus === "queued") {
        const upstream = await tryCancelUpstreamVideoTask(env, db, job);
        if (upstream.deleted) {
          const cancelled = await finalizeJobCancelled(env, db, job);
          return cancelled ?? job;
        }
        return revertVideoCancelToGenerating(env, db, job);
      }

      return (
        (await updateGenerationJob(db, {
          id: job.id,
          organizationId: job.organizationId,
          status: "cancelling",
          expectedStatuses: ["cancelling"],
          resultJson: {
            ...(job.resultJson ?? {}),
            upstreamVideoStatus,
            nextUpstreamPollAt: nextVideoUpstreamPollAt(upstreamVideoStatus),
          },
        })) ?? job
      );
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
          nextUpstreamPollAt: nextVideoUpstreamPollAt(upstreamVideoStatus),
        },
      })) ?? job
    );
  }

  if (job.status === "cancelling") {
    job = await revertVideoCancelToGenerating(env, db, job);
  }

  const readyAt = new Date().toISOString();
  const previousResult = job.resultJson ?? {};
  const { upstreamVideoStatus: _upstreamVideoStatus, ...restResult } =
    previousResult;
  const pendingItem = buildVideoPendingMedia(job, pollResult.videoUrl);
  const resultJson: GenerationJobResultJson = {
    ...restResult,
    pendingMedia: [pendingItem],
    upstreamTaskId: job.upstreamTaskId,
    aiInterfaceId: job.interfaceId,
  };

  const videoResourceId = pendingItem.resourceId?.trim();
  if (videoResourceId) {
    await upsertMediaResources(db, [
      {
        id: videoResourceId,
        organizationId: job.organizationId,
        kind: "ephemeral",
        mimeType: pendingItem.mimeType,
        upstreamUrl: pollResult.videoUrl,
        expiresAt: createEphemeralMediaExpiresAt(),
        generating: false,
        failed: false,
        modelCanonicalId: job.modelCanonicalId,
      },
    ]);
  }

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
      db,
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
      await markJobResourcesCloudAccelerationStatus(db, succeeded, "done");
      await registerMediaResourceTransitions(db, {
        organizationId: claimed.organizationId,
        transitions: buildMediaResourceTransitionsFromJobComplete(
          pendingMedia,
          finalMedia
        ),
      });
      try {
        await persistJobFinalizedGeneratingContent(
          env,
          succeeded,
          pendingMedia,
          finalMedia
        );
      } catch {
        // Catalog already transitioned; node JSON is aligned by client or a later sync.
      }
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
      await markJobResourcesCloudAccelerationStatus(db, failed, "failed");
      await markMediaResourcesFailed(db, {
        organizationId: failed.organizationId,
        resourceIds: failed.resultJson?.placeholderResourceIds ?? [],
        mimeType: placeholderMimeTypeForModality(failed.modality),
      });
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

  await markJobResourcesCloudAccelerationStatus(db, claimed, "active");
  await syncJobCloudAccelerationToWorkflow(env, claimed, "active");

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
    return toGetGenerationJobResponse(db, job);
  }

  if (job.status === "uploading") {
    return toGetGenerationJobResponse(db, job);
  }

  if (job.status !== "ready_to_persist") {
    return toGetGenerationJobResponse(db, job);
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

  return claimed ? toGetGenerationJobResponse(db, claimed) : null;
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
    return toGetGenerationJobResponse(db, job);
  }

  if (
    (job.status === "generating" || job.status === "cancelling") &&
    job.modality === "video"
  ) {
    job = await pollVideoGenerationJob(env, db, job);
  }

  if (job.status !== "ready_to_persist" && job.status !== "uploading") {
    return toGetGenerationJobResponse(db, job);
  }

  if (
    job.status === "uploading" &&
    readPersistOwner(job) === "server"
  ) {
    return toGetGenerationJobResponse(db, job);
  }

  await markJobResourcesCloudAccelerationStatus(db, job, "pending");
  await syncJobCloudAccelerationToWorkflow(env, job, "pending");
  const persisted = await runServerGenerationJobPersist(env, db, job);
  return toGetGenerationJobResponse(db, persisted);
}

export async function cancelUserGenerationJob(
  env: Bindings,
  organizationId: string,
  jobId: string
): Promise<CancelGenerationJobResponse | null> {
  const db = createDatabase(env);
  const job = await getGenerationJob(db, jobId, organizationId);
  if (!job) {
    return null;
  }

  return cancelGenerationJobRecord(env, db, job);
}

export async function cancelUserGenerationJobByClientRequestId(
  env: Bindings,
  organizationId: string,
  clientRequestId: string
): Promise<CancelGenerationJobResponse | null> {
  const db = createDatabase(env);
  const job = await getGenerationJobByClientRequestId(db, {
    organizationId,
    clientRequestId,
  });
  if (!job) {
    return null;
  }

  return cancelGenerationJobRecord(env, db, job);
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

  if (
    (job.status === "generating" || job.status === "cancelling") &&
    job.modality === "video"
  ) {
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

  if (job.status === "failed") {
    await ensureFailedJobPlaceholderResourcesMarked(db, job);
  }

  return toGetGenerationJobResponse(db, job);
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
    return toGetGenerationJobResponse(db, job);
  }

  if (job.status === "succeeded") {
    return toGetGenerationJobResponse(db, job);
  }

  if (job.status !== "ready_to_persist" && job.status !== "uploading") {
    return toGetGenerationJobResponse(db, job);
  }

  if (
    job.status === "uploading" &&
    readPersistOwner(job) === "server"
  ) {
    return toGetGenerationJobResponse(db, job);
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
    const pendingMedia = extractPendingMediaFromJob(job) ?? [];
    await registerMediaResourceTransitions(db, {
      organizationId: params.organizationId,
      transitions: buildMediaResourceTransitionsFromJobComplete(
        pendingMedia,
        validatedFinalMedia
      ),
    });
    try {
      await persistJobFinalizedGeneratingContent(
        env,
        updated,
        pendingMedia,
        validatedFinalMedia
      );
    } catch {
      // Catalog already transitioned; node JSON is aligned by client or a later sync.
    }
    await syncGenerationJobInvocation(db, updated);
    return toGetGenerationJobResponse(db, updated);
  }

  return null;
}

export function buildReadyToPersistJobPayload(params: {
  readonly images: readonly MediaReference[];
  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio";
  readonly aiInterfaceId: string;
  readonly invocationId?: string;
  readonly requestSnapshot?: GenerationJobResultJson["requestSnapshot"];
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
      ...(params.requestSnapshot
        ? { requestSnapshot: params.requestSnapshot }
        : {}),
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
    readonly requestSnapshot?: GenerationJobResultJson["requestSnapshot"];
  }
): Promise<GenerationJobRecord> {
  const { readyAt, resultJson } = buildReadyToPersistJobPayload({
    images: params.images,
    mediaKind: "ai-image",
    aiInterfaceId: params.interfaceId,
    invocationId: params.invocationId,
    requestSnapshot: params.requestSnapshot,
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
  }).then(async (job) => {
    await registerMediaResourcesFromReferences(db, {
      organizationId: params.organizationId,
      references: params.images,
      modelCanonicalId: params.modelCanonicalId,
    });
    return job;
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
  const existing = await getGenerationJob(db, params.id, params.organizationId);
  const { readyAt, resultJson: readyJson } = buildReadyToPersistJobPayload({
    images: params.audios,
    mediaKind: "ai-audio",
    aiInterfaceId: params.interfaceId,
    invocationId: params.invocationId,
  });
  const placeholderResourceIds =
    existing?.resultJson?.placeholderResourceIds ??
    readyJson.pendingMedia
      ?.map((item) => item.resourceId)
      .filter((id): id is string => Boolean(id));
  const resultJson: GenerationJobResultJson = {
    ...(existing?.resultJson ?? {}),
    ...readyJson,
    ...(placeholderResourceIds && placeholderResourceIds.length > 0
      ? { placeholderResourceIds }
      : {}),
  };

  const job = existing
    ? await updateGenerationJob(db, {
        id: params.id,
        organizationId: params.organizationId,
        status: "ready_to_persist",
        expectedStatuses: ["generating"],
        readyAt,
        resultJson,
      })
    : await createGenerationJob(db, {
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

  if (!job) {
    throw new Error("Failed to mark audio job ready to persist");
  }

  await registerMediaResourcesFromReferences(db, {
    organizationId: params.organizationId,
    references: params.audios,
    modelCanonicalId: params.modelCanonicalId,
  });
  return job;
}

export { GenerationJobUploadValidationError } from "./validate-generation-job-upload";
