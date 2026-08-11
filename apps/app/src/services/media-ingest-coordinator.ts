import { getResourceIdFromValue, type WorkflowMediaValue } from "@dafthunk/types";

import {
  generateCacheResourceTiers,
  getCachedMediaBlob,
} from "@/services/ai-media-cache-service";
import { notifyAiMediaCacheChanged } from "@/services/ai-media-cache-events";
import { ensureGenerativeMediaCached } from "@/services/stage-generative-media";

const FAILED_COOLDOWN_MS = 30_000;

type IngestCoordinatorState = "idle" | "downloading" | "done" | "failed";

interface IngestCoordinatorEntry {
  readonly state: IngestCoordinatorState;
  readonly promise: Promise<void> | null;
  readonly failedAt: number | null;
}

export interface IngestCanvasMediaParams {
  readonly organizationId: string;
  readonly workflowId: string | undefined;
  readonly media: WorkflowMediaValue;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly blob?: Blob;
}

function ingestCoordinatorKey(
  organizationId: string,
  workflowId: string,
  mediaId: string
): string {
  return `${organizationId}:${workflowId}:${mediaId}`;
}

function resolveIngestMediaId(params: IngestCanvasMediaParams): string | null {
  if (!params.workflowId) {
    return null;
  }
  return getResourceIdFromValue(params.media);
}

const ingestCoordinator = new Map<string, IngestCoordinatorEntry>();

function readCoordinatorEntry(key: string): IngestCoordinatorEntry {
  return (
    ingestCoordinator.get(key) ?? {
      state: "idle",
      promise: null,
      failedAt: null,
    }
  );
}

function isInFailedCooldown(entry: IngestCoordinatorEntry): boolean {
  if (entry.state !== "failed" || entry.failedAt == null) {
    return false;
  }
  return Date.now() - entry.failedAt < FAILED_COOLDOWN_MS;
}

async function isMediaCachedInIndexedDb(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): Promise<boolean> {
  const blob = await getCachedMediaBlob(params);
  return blob != null;
}

async function finishIngestSideEffects(
  params: IngestCanvasMediaParams,
  mediaId: string
): Promise<void> {
  if (params.nodeType === "ai-image" || params.nodeType === "ai-video") {
    await generateCacheResourceTiers({
      organizationId: params.organizationId,
      workflowId: params.workflowId!,
      mediaId,
    });
    notifyAiMediaCacheChanged();
  }
}

async function runIngestCanvasMediaWork(
  params: IngestCanvasMediaParams
): Promise<void> {
  if (!params.workflowId) {
    return;
  }

  const mediaId = resolveIngestMediaId(params);
  if (!mediaId) {
    return;
  }

  const cacheParams = {
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId,
  };

  const alreadyCached = await isMediaCachedInIndexedDb(cacheParams);
  if (!alreadyCached) {
    await ensureGenerativeMediaCached(params);
    const cachedAfterIngest = await isMediaCachedInIndexedDb(cacheParams);
    if (!cachedAfterIngest && !params.blob) {
      throw new Error("Media ingest did not populate local cache");
    }
  }

  await finishIngestSideEffects(params, mediaId);
}

export function resetMediaIngestState(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): void {
  ingestCoordinator.delete(
    ingestCoordinatorKey(
      params.organizationId,
      params.workflowId,
      params.mediaId
    )
  );
}

export async function coordinateIngestCanvasMedia(
  params: IngestCanvasMediaParams
): Promise<void> {
  const mediaId = resolveIngestMediaId(params);
  if (!mediaId || !params.workflowId) {
    return;
  }

  const key = ingestCoordinatorKey(
    params.organizationId,
    params.workflowId,
    mediaId
  );
  const cacheParams = {
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId,
  };

  if (await isMediaCachedInIndexedDb(cacheParams)) {
    ingestCoordinator.set(key, {
      state: "done",
      promise: null,
      failedAt: null,
    });
    await finishIngestSideEffects(params, mediaId);
    return;
  }

  const existing = readCoordinatorEntry(key);
  if (isInFailedCooldown(existing)) {
    return;
  }

  if (existing.state === "downloading" && existing.promise) {
    await existing.promise;
    return;
  }

  if (existing.state === "done") {
    await finishIngestSideEffects(params, mediaId);
    return;
  }

  const promise = runIngestCanvasMediaWork(params)
    .then(() => {
      ingestCoordinator.set(key, {
        state: "done",
        promise: null,
        failedAt: null,
      });
    })
    .catch(() => {
      ingestCoordinator.set(key, {
        state: "failed",
        promise: null,
        failedAt: Date.now(),
      });
    });

  ingestCoordinator.set(key, {
    state: "downloading",
    promise,
    failedAt: null,
  });

  await promise;
}
