import type {
  GenerationJobPendingMedia,
  GenerationJobRecord,
  ObjectReference,
  ResourceIdReference,
  WorkflowMediaValue,
} from "@dafthunk/types";
import {
  isGenerationJobReadyAtExpired,
  isServerPersistInProgress,
  shouldDeferClientPersistToServer,
  VIDEO_JOB_CLIENT_POLL_INTERVAL_MS,
} from "@dafthunk/types";

import type { GenerativeProgressPhase } from "@/components/workflow/generative-progress-utils";
import { GenerativeGenerationCancelledError } from "@/components/workflow/generative-generation-cancel";
import { fetchBlobWithProgress } from "@/services/fetch-blob-with-progress";
import { buildMediaProxyEndpoint } from "@/services/media-cache-fetch-utils";
import { allocateGenerativeMediaResourceId } from "@/services/allocate-generative-media-resource-id";
import {
  readGenerativeStagingByMediaId,
  writeGenerativeStagingWithResourceId,
} from "@/services/generative-media-staging";
import {
  claimGenerationJobClientUpload,
  completeGenerationJobUpload,
  getGenerationJob,
} from "@/services/platform-ai-model-service";
import {
  cloudUploadToResourceId,
  uploadGenerativeMediaFromLocalStaging,
} from "@/services/stage-generative-media";

export type PersistGenerativeMediaPhase = "downloading" | "uploading";

const JOB_POLL_INTERVAL_MS = VIDEO_JOB_CLIENT_POLL_INTERVAL_MS;
const MIN_RETRY_INTERVAL_MS = 3_000;
const MAX_RETRY_INTERVAL_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function resourceRefFromStaging(
  resourceId: string,
  mimeType: string
): ResourceIdReference {
  return { resourceId, mimeType, kind: "local" };
}

async function resolveExistingStagedRefs(
  stagingResourceIds: readonly string[]
): Promise<ResourceIdReference[]> {
  const refs: ResourceIdReference[] = [];
  for (const resourceId of stagingResourceIds) {
    const entry = await readGenerativeStagingByMediaId(resourceId);
    if (!entry) {
      return [];
    }
    refs.push(resourceRefFromStaging(resourceId, entry.mimeType));
  }
  return refs;
}

async function downloadToAiStaging(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly item: GenerationJobPendingMedia;
  readonly onPhase?: (phase: PersistGenerativeMediaPhase) => void;
  readonly onDownloadProgress?: (percent: number) => void;
}): Promise<ResourceIdReference> {
  params.onPhase?.("downloading");

  const fetchUrl = buildMediaProxyEndpoint(
    params.organizationId,
    params.item.sourceUrl,
    params.item.mimeType
  );
  const blob = await fetchBlobWithProgress(
    fetchUrl,
    { credentials: "include" },
    params.onDownloadProgress
  );
  const mimeType =
    params.item.mimeType ||
    blob.type ||
    (params.item.mediaKind === "ai-video"
      ? "video/mp4"
      : params.item.mediaKind === "ai-audio"
        ? "audio/mpeg"
        : "image/png");

  const resourceId = params.item.resourceId?.trim() || allocateGenerativeMediaResourceId();
  await writeGenerativeStagingWithResourceId({
    organizationId: params.organizationId,
    workflowId: params.workflowId ?? "uploads",
    resourceId,
    blob,
    mimeType,
    nodeType: params.item.mediaKind,
  });

  return resourceRefFromStaging(resourceId, mimeType);
}

async function uploadFromAiStaging(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly stagedRef: ResourceIdReference;
  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio";
  readonly objectId?: string;
  readonly onPhase?: (phase: PersistGenerativeMediaPhase) => void;
}): Promise<ObjectReference> {
  params.onPhase?.("uploading");
  return uploadGenerativeMediaFromLocalStaging({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId: params.stagedRef.resourceId,
    mimeType: params.stagedRef.mimeType ?? "application/octet-stream",
    mediaKind: params.mediaKind,
    objectId: params.objectId ?? params.stagedRef.resourceId,
  });
}

function throwIfTerminal(job: GenerationJobRecord): void {
  if (job.status === "cancelled") {
    throw new Error(
      job.failureReason ?? "Generation cancelled due to cloud storage"
    );
  }
  if (job.status === "failed") {
    throw new Error(job.failureReason ?? "Generation failed");
  }
}

async function waitForJobReadyToPersist(params: {
  readonly organizationId: string;
  readonly jobId: string;
  readonly onProgressPhase?: (phase: GenerativeProgressPhase) => void;
  readonly shouldAbortJobPoll?: () => boolean;
}): Promise<Awaited<ReturnType<typeof getGenerationJob>>> {
  while (true) {
    const response = await getGenerationJob(params.organizationId, params.jobId);
    throwIfTerminal(response.job);

    if (response.job.status === "succeeded") {
      return response;
    }

    if (
      response.job.status === "ready_to_persist" ||
      (response.job.status === "uploading" &&
        response.job.resultJson?.persistOwner === "client")
    ) {
      return response;
    }

    if (params.shouldAbortJobPoll?.()) {
      throw new GenerativeGenerationCancelledError();
    }

    if (
      isGenerationJobReadyAtExpired(response.job.readyAt) &&
      isServerPersistInProgress(response.job)
    ) {
      params.onProgressPhase?.("server_persisting");
    } else if (response.displayPhase === "queued") {
      params.onProgressPhase?.("queued");
    }

    await sleep(JOB_POLL_INTERVAL_MS);
  }
}

async function pollUntilJobSucceeded(params: {
  readonly organizationId: string;
  readonly jobId: string;
  readonly onProgressPhase?: (phase: GenerativeProgressPhase) => void;
}): Promise<Awaited<ReturnType<typeof getGenerationJob>>> {
  while (true) {
    const response = await getGenerationJob(params.organizationId, params.jobId);
    throwIfTerminal(response.job);

    if (response.job.status === "succeeded") {
      return response;
    }

    if (shouldDeferClientPersistToServer(response.job)) {
      params.onProgressPhase?.("server_persisting");
    }

    await sleep(JOB_POLL_INTERVAL_MS);
  }
}

function allStagedRefsReady(
  stagedRefs: readonly (ResourceIdReference | undefined)[],
  count: number
): stagedRefs is ResourceIdReference[] {
  return stagedRefs.length === count && stagedRefs.every(Boolean);
}

export async function runGenerationJobPersistWorker(params: {
  readonly organizationId: string;
  readonly jobId: string;
  readonly workflowId?: string;
  readonly stagingMediaIds?: readonly string[];
  readonly onPhase?: (phase: PersistGenerativeMediaPhase) => void;
  readonly onProgressPhase?: (phase: GenerativeProgressPhase) => void;
  readonly onDownloadProgress?: (percent: number) => void;
  readonly onStaged?: (stagedMedia: readonly ResourceIdReference[]) => void;
  readonly shouldAbortJobPoll?: () => boolean;
}): Promise<readonly WorkflowMediaValue[]> {
  const notify = params.onProgressPhase;

  const ready = await waitForJobReadyToPersist({
    organizationId: params.organizationId,
    jobId: params.jobId,
    onProgressPhase: notify,
    shouldAbortJobPoll: params.shouldAbortJobPoll,
  });

  if (ready.finalMedia && ready.finalMedia.length > 0) {
    return ready.finalMedia;
  }

  const pendingMedia = ready.pendingMedia ?? [];
  if (pendingMedia.length === 0) {
    throw new Error("Generation job has no media to persist");
  }

  const stagedRefs: (ResourceIdReference | undefined)[] = [];
  if (params.stagingMediaIds && params.stagingMediaIds.length > 0) {
    const restored = await resolveExistingStagedRefs(params.stagingMediaIds);
    if (restored.length === pendingMedia.length) {
      restored.forEach((ref, index) => {
        stagedRefs[index] = ref;
      });
      params.onStaged?.(restored);
    }
  }

  let retryIntervalMs = MIN_RETRY_INTERVAL_MS;

  while (true) {
    const response = await getGenerationJob(params.organizationId, params.jobId);
    throwIfTerminal(response.job);

    if (response.job.status === "succeeded") {
      if (response.finalMedia && response.finalMedia.length > 0) {
        return response.finalMedia;
      }
      if (allStagedRefsReady(stagedRefs, pendingMedia.length)) {
        return stagedRefs;
      }
      throw new Error("Generation succeeded without display media");
    }

    if (
      isGenerationJobReadyAtExpired(response.job.readyAt) &&
      isServerPersistInProgress(response.job)
    ) {
      notify?.("server_persisting");
      const succeeded = await pollUntilJobSucceeded({
        organizationId: params.organizationId,
        jobId: params.jobId,
        onProgressPhase: notify,
      });
      if (succeeded.finalMedia && succeeded.finalMedia.length > 0) {
        return succeeded.finalMedia;
      }
      if (allStagedRefsReady(stagedRefs, pendingMedia.length)) {
        return stagedRefs;
      }
      return [];
    }

    if (response.job.status === "ready_to_persist") {
      await claimGenerationJobClientUpload(params.organizationId, params.jobId);
    }

    let downloadFailed = false;

    for (let index = 0; index < pendingMedia.length; index += 1) {
      if (stagedRefs[index]) {
        continue;
      }

      notify?.("downloading");

      try {
        stagedRefs[index] = await downloadToAiStaging({
          organizationId: params.organizationId,
          workflowId: params.workflowId,
          item: pendingMedia[index]!,
          onPhase: params.onPhase,
          onDownloadProgress: params.onDownloadProgress,
        });
        params.onStaged?.(
          stagedRefs.filter((ref): ref is ResourceIdReference => Boolean(ref))
        );
        notify?.("uploading");
        retryIntervalMs = MIN_RETRY_INTERVAL_MS;
      } catch {
        downloadFailed = true;
        break;
      }
    }

    if (downloadFailed || !allStagedRefsReady(stagedRefs, pendingMedia.length)) {
      await sleep(retryIntervalMs);
      retryIntervalMs = Math.min(
        Math.round(retryIntervalMs * 1.5),
        MAX_RETRY_INTERVAL_MS
      );
      continue;
    }

    notify?.("uploading");

    const objectRefs: ObjectReference[] = [];
    let uploadFailed = false;

    for (let index = 0; index < pendingMedia.length; index += 1) {
      try {
        objectRefs[index] = await uploadFromAiStaging({
          organizationId: params.organizationId,
          workflowId: params.workflowId,
          stagedRef: stagedRefs[index]!,
          mediaKind: pendingMedia[index]!.mediaKind,
          objectId: pendingMedia[index]!.resourceId,
          onPhase: params.onPhase,
        });
      } catch {
        uploadFailed = true;
        break;
      }
    }

    if (uploadFailed || objectRefs.length !== pendingMedia.length) {
      notify?.("uploading");
      await sleep(retryIntervalMs);
      retryIntervalMs = Math.min(
        Math.round(retryIntervalMs * 1.5),
        MAX_RETRY_INTERVAL_MS
      );
      continue;
    }

    await completeGenerationJobUpload(
      params.organizationId,
      params.jobId,
      objectRefs
    );

    return objectRefs.map((object) => cloudUploadToResourceId(object));
  }
}
