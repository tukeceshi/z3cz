import type { GenerationJobPendingMedia, GenerationJobRecord } from "./generation-job";
import type { MediaReference } from "./media-reference";

export const GENERATION_JOB_WORKER_CLAIM_TIMEOUT_MS = 900_000;

export type PersistWorkerDeployStatus =
  | "manual"
  | "deploying"
  | "active"
  | "failed";

export interface PersistWorker {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly maxConcurrentJobs: number;
  readonly activeJobCount: number;
  readonly host: string | null;
  readonly sshPort: number;
  readonly sshUsername: string | null;
  readonly deployStatus: PersistWorkerDeployStatus;
  readonly deployError: string | null;
  readonly lastDeployAt: string | null;
  readonly initializedAt: string | null;
  readonly lastHeartbeatAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedBy: string | null;
}

export interface PersistWorkerPoolSettings {
  readonly enabled: boolean;
}

export interface ListPersistWorkersResponse {
  readonly workers: readonly PersistWorker[];
  readonly settings: PersistWorkerPoolSettings;
}

export interface CreatePersistWorkerRequest {
  readonly id?: string;
  readonly name: string;
  readonly enabled?: boolean;
  readonly maxConcurrentJobs?: number;
}

export interface CreatePersistWorkerResponse {
  readonly worker: PersistWorker;
  /** Plain secret — shown once at creation. */
  readonly secret: string;
}

export interface BootstrapPersistWorkerRequest {
  readonly id?: string;
  readonly name: string;
  readonly host: string;
  readonly sshPort?: number;
  readonly sshUsername: string;
  readonly sshPassword: string;
  readonly maxConcurrentJobs?: number;
  readonly apiBaseUrl?: string;
}

export interface BootstrapPersistWorkerResponse {
  readonly worker: PersistWorker;
  readonly deployLog: string;
}

export interface RedeployPersistWorkerRequest {
  readonly sshPassword: string;
  readonly apiBaseUrl?: string;
}

export interface RedeployPersistWorkerResponse {
  readonly worker: PersistWorker;
  readonly deployLog: string;
}

export interface UpdatePersistWorkerRequest {
  readonly name?: string;
  readonly enabled?: boolean;
  readonly maxConcurrentJobs?: number;
  readonly rotateSecret?: boolean;
}

export interface UpdatePersistWorkerResponse {
  readonly worker: PersistWorker;
  readonly secret?: string;
}

export interface PersistWorkerClaimJobResponse {
  readonly job: GenerationJobRecord;
  readonly pendingMedia: readonly GenerationJobPendingMedia[];
}

export interface PersistWorkerPresignUploadItem {
  readonly index: number;
  readonly contentLength: number;
  readonly mimeType: string;
}

export interface PersistWorkerPresignUploadSlot {
  readonly index: number;
  readonly uploadUrl: string;
  readonly uploadHeaders: Record<string, string>;
  readonly reference: MediaReference;
}

export interface PersistWorkerPresignUploadsResponse {
  readonly slots: readonly PersistWorkerPresignUploadSlot[];
}

export interface PersistWorkerCompleteJobRequest {
  readonly finalMedia: readonly MediaReference[];
}

export interface PersistWorkerFailJobRequest {
  readonly reason: string;
}
