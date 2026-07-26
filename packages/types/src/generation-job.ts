import type { MediaReference } from "./media-reference";

export type GenerationJobModality = "image" | "video" | "audio";

export type GenerationJobStatus =
  | "pending"
  | "generating"
  | "ready_to_persist"
  | "uploading"
  | "succeeded"
  | "failed"
  | "cancelled";

export const ACTIVE_GENERATION_JOB_STATUSES = [
  "pending",
  "generating",
  "ready_to_persist",
  "uploading",
] as const satisfies readonly GenerationJobStatus[];

export type ActiveGenerationJobStatus =
  (typeof ACTIVE_GENERATION_JOB_STATUSES)[number];

export const GENERATION_JOB_SERVER_PERSIST_AFTER_MS = 1_800_000;

export function isGenerationJobReadyAtExpired(
  readyAt: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!readyAt) {
    return false;
  }
  return (
    Date.parse(readyAt) + GENERATION_JOB_SERVER_PERSIST_AFTER_MS <= nowMs
  );
}

/** Server has claimed persist — client must stop uploading and poll job status. */
export function isServerPersistInProgress(job: {
  readonly status: GenerationJobStatus;
  readonly resultJson?: GenerationJobResultJson | null;
}): boolean {
  if (job.status === "succeeded") {
    return true;
  }
  return (
    job.status === "uploading" &&
    job.resultJson?.persistOwner === "server"
  );
}

export function shouldDeferClientPersistToServer(job: {
  readonly status: GenerationJobStatus;
  readonly readyAt: string | null;
  readonly resultJson?: GenerationJobResultJson | null;
}): boolean {
  return isServerPersistInProgress(job);
}

export type GenerationJobPersistOwner = "client" | "server";

export type GenerationJobDisplayPhase =
  | "generating"
  | "ready_to_persist"
  | "downloading"
  | "uploading"
  | "server_persisting"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface GenerationJobPendingMedia {
  readonly sourceUrl: string;
  readonly mimeType: string;
  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio";
}

export type GenerationJobPersistDispatch = "api" | "worker";

export interface GenerationJobResultJson {
  readonly pendingMedia?: readonly GenerationJobPendingMedia[];
  readonly finalMedia?: readonly MediaReference[];
  readonly upstreamTaskId?: string;
  readonly videoPollUrl?: string;
  readonly aiInterfaceId?: string;
  readonly invocationId?: string;
  readonly persistOwner?: GenerationJobPersistOwner;
  readonly clientPersistStartedAt?: string;
  readonly persistDispatch?: GenerationJobPersistDispatch;
  readonly persistWorkerId?: string;
  readonly workerDispatchedAt?: string;
  readonly workerClaimedAt?: string;
}

export interface GenerationJobRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string | null;
  readonly workflowId: string | null;
  readonly nodeId: string | null;
  readonly modality: GenerationJobModality;
  readonly status: GenerationJobStatus;
  readonly upstreamTaskId: string | null;
  readonly modelCanonicalId: string;
  readonly interfaceId: string;
  readonly failureReason: string | null;
  readonly healthReason: string | null;
  readonly readyAt: string | null;
  readonly resultJson: GenerationJobResultJson | null;
  readonly clientRequestId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface GetGenerationJobResponse {
  readonly job: GenerationJobRecord;
  readonly pendingMedia?: readonly GenerationJobPendingMedia[];
  readonly finalMedia?: readonly MediaReference[];
  readonly displayPhase?: GenerationJobDisplayPhase;
  /** True when server is persisting or job succeeded — client must not upload locally. */
  readonly deferClientPersistToServer?: boolean;
}

export interface ClaimGenerationJobClientUploadResponse {
  readonly job: GenerationJobRecord;
  readonly displayPhase: GenerationJobDisplayPhase;
}

export interface RequestGenerationJobServerPersistResponse {
  readonly job: GenerationJobRecord;
  readonly displayPhase: GenerationJobDisplayPhase;
  readonly finalMedia?: readonly MediaReference[];
}

export interface CompleteGenerationJobUploadRequest {
  readonly finalMedia: readonly MediaReference[];
}

export interface CompleteGenerationJobUploadResponse {
  readonly job: GenerationJobRecord;
  readonly finalMedia: readonly MediaReference[];
}
