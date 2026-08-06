import type {
  GenerationJobPendingMedia,
  GenerationJobRecord,
  LocalMediaReference,
  MediaReference,
  ObjectReference,
} from "@dafthunk/types";
import {
  isGenerationJobReadyAtExpired,
  isServerPersistInProgress,
  shouldDeferClientPersistToServer,
  VIDEO_JOB_CLIENT_POLL_INTERVAL_MS,
} from "@dafthunk/types";

import type { GenerativeProgressPhase } from "@/components/workflow/generative-progress-utils";
import { GenerativeGenerationCancelledError } from "@/components/workflow/generative-generation-cancel";
import { buildMediaProxyEndpoint } from "@/services/media-cache-fetch-utils";
import {
  readGenerativeStagingByMediaId,
  writeGenerativeStagingWithNewId,
} from "@/services/generative-media-staging";
import {
  claimGenerationJobClientUpload,
  completeGenerationJobUpload,
  getGenerationJob,
} from "@/services/platform-ai-model-service";
import { uploadGenerativeMediaFromLocalStaging } from "@/services/upload-generative-media";

export type PersistGenerativeMediaPhase = "downloading" | "uploading";

const JOB_POLL_INTERVAL_MS = VIDEO_JOB_CLIENT_POLL_INTERVAL_MS;
const MIN_RETRY_INTERVAL_MS = 3_000;
const MAX_RETRY_INTERVAL_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function localRefFromStaging(
  mediaId: string,
  mimeType: string
): LocalMediaReference {
  return { kind: "local", mediaId, mimeType };
}

async function resolveExistingLocalRefs(
  stagingMediaIds: readonly string[]
): Promise<LocalMediaReference[]> {
  const refs: LocalMediaReference[] = [];
  for (const mediaId of stagingMediaIds) {
    const entry = await readGenerativeStagingByMediaId(mediaId);
    if (!entry) {
      return [];
    }
    refs.push(localRefFromStaging(mediaId, entry.mimeType));
  }
  return refs;
}

async function downloadToAiStaging(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly item: GenerationJobPendingMedia;
  readonly onPhase?: (phase: PersistGenerativeMediaPhase) => void;
}): Promise<LocalMediaReference> {
  params.onPhase?.("downloading");

  const fetchUrl = buildMediaProxyEndpoint(
    params.organizationId,
    params.item.sourceUrl,
    params.item.mimeType
  );
  const response = await fetch(fetchUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to download generated media (${response.status})`);
  }

  const blob = await response.blob();
  const mimeType =
    params.item.mimeType ||
    blob.type ||
    (params.item.mediaKind === "ai-video"
      ? "video/mp4"
      : params.item.mediaKind === "ai-audio"
        ? "audio/mpeg"
        : "image/png");

  const { mediaId } = await writeGenerativeStagingWithNewId({
    organizationId: params.organizationId,
    workflowId: params.workflowId ?? "uploads",
    blob,
    mimeType,
    nodeType: params.item.mediaKind,
  });

  return localRefFromStaging(mediaId, mimeType);
}

async function uploadFromAiStaging(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly localRef: LocalMediaReference;
  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio";
  readonly onPhase?: (phase: PersistGenerativeMediaPhase) => void;
}): Promise<ObjectReference> {
  params.onPhase?.("uploading");
  return uploadGenerativeMediaFromLocalStaging({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId: params.localRef.mediaId,
    mimeType: params.localRef.mimeType,
    mediaKind: params.mediaKind,
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
    } else {
      params.onProgressPhase?.("generating");
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

function allLocalRefsReady(
  localRefs: readonly (LocalMediaReference | undefined)[],
  count: number
): localRefs is LocalMediaReference[] {
  return localRefs.length === count && localRefs.every(Boolean);
}

export async function runGenerationJobPersistWorker(params: {
  readonly organizationId: string;
  readonly jobId: string;
  readonly workflowId?: string;
  readonly stagingMediaIds?: readonly string[];
  readonly onPhase?: (phase: PersistGenerativeMediaPhase) => void;
  readonly onProgressPhase?: (phase: GenerativeProgressPhase) => void;
  readonly onStaged?: (localMedia: readonly LocalMediaReference[]) => void;
  readonly shouldAbortJobPoll?: () => boolean;
}): Promise<readonly MediaReference[]> {
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

  const localRefs: (LocalMediaReference | undefined)[] = [];
  if (params.stagingMediaIds && params.stagingMediaIds.length > 0) {
    const restored = await resolveExistingLocalRefs(params.stagingMediaIds);
    if (restored.length === pendingMedia.length) {
      restored.forEach((ref, index) => {
        localRefs[index] = ref;
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
      if (allLocalRefsReady(localRefs, pendingMedia.length)) {
        return localRefs;
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
      if (allLocalRefsReady(localRefs, pendingMedia.length)) {
        return localRefs;
      }
      return [];
    }

    if (response.job.status === "ready_to_persist") {
      await claimGenerationJobClientUpload(params.organizationId, params.jobId);
    }

    let downloadFailed = false;

    for (let index = 0; index < pendingMedia.length; index += 1) {
      if (localRefs[index]) {
        continue;
      }

      notify?.("downloading");

      try {
        localRefs[index] = await downloadToAiStaging({
          organizationId: params.organizationId,
          workflowId: params.workflowId,
          item: pendingMedia[index]!,
          onPhase: params.onPhase,
        });
        params.onStaged?.(
          localRefs.filter((ref): ref is LocalMediaReference => Boolean(ref))
        );
        notify?.("uploading");
        retryIntervalMs = MIN_RETRY_INTERVAL_MS;
      } catch {
        downloadFailed = true;
        break;
      }
    }

    if (downloadFailed || !allLocalRefsReady(localRefs, pendingMedia.length)) {
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
          localRef: localRefs[index]!,
          mediaKind: pendingMedia[index]!.mediaKind,
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

    return objectRefs;
  }
}
