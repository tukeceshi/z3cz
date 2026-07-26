import type {
  GenerateAiAudioResponse,
  GenerateAiImageResponse,
  GenerationJobModality,
  GenerationJobRecord,
  MediaReference,
  SubmitAiVideoResponse,
} from "@dafthunk/types";
import { isMediaReference } from "@dafthunk/types";

import type { Database } from "../db";
import {
  extractFinalMediaFromJob,
  findActiveGenerationJobForNode,
  getGenerationJobByClientRequestId,
} from "../db/generation-job-queries";

export class ActiveGenerationJobConflictError extends Error {
  readonly code = "active_generation_job_exists" as const;
  readonly jobId: string;

  constructor(jobId: string) {
    super("An active generation job already exists for this node");
    this.name = "ActiveGenerationJobConflictError";
    this.jobId = jobId;
  }
}

export async function assertNoActiveGenerationJobForNode(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly workflowId?: string;
    readonly nodeId?: string;
    readonly modality: GenerationJobModality;
    readonly clientRequestId?: string;
  }
): Promise<void> {
  const workflowId = params.workflowId?.trim();
  const nodeId = params.nodeId?.trim();
  if (!workflowId || !nodeId) {
    return;
  }

  const active = await findActiveGenerationJobForNode(db, {
    organizationId: params.organizationId,
    workflowId,
    nodeId,
    modality: params.modality,
  });

  if (!active) {
    return;
  }

  const clientRequestId = params.clientRequestId?.trim();
  if (clientRequestId && active.clientRequestId === clientRequestId) {
    return;
  }

  throw new ActiveGenerationJobConflictError(active.id);
}

export async function findGenerationJobByClientRequestId(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly clientRequestId?: string;
    readonly modality: GenerationJobModality;
  }
): Promise<GenerationJobRecord | null> {
  const clientRequestId = params.clientRequestId?.trim();
  if (!clientRequestId) {
    return null;
  }

  const existing = await getGenerationJobByClientRequestId(db, {
    organizationId: params.organizationId,
    clientRequestId,
  });

  if (!existing || existing.modality !== params.modality) {
    return null;
  }

  return existing;
}


export function buildImageGenerateResponseFromJob(
  job: GenerationJobRecord
): GenerateAiImageResponse {
  const finalMedia = extractFinalMediaFromJob(job);
  const images =
    job.status === "succeeded" && finalMedia && finalMedia.length > 0
      ? finalMedia.filter(isMediaReference)
      : [];

  const phase =
    job.status === "succeeded"
      ? ("succeeded" as const)
      : job.status === "ready_to_persist" || job.status === "uploading"
        ? ("ready_to_persist" as const)
        : ("ready_to_persist" as const);

  return {
    images,
    invocationId: job.resultJson?.invocationId ?? job.id,
    aiInterfaceId: job.interfaceId,
    storageMode: "cloud",
    jobId: job.id,
    phase,
  };
}

export function buildAudioGenerateResponseFromJob(
  job: GenerationJobRecord
): GenerateAiAudioResponse {
  const finalMedia = extractFinalMediaFromJob(job);
  const audios =
    job.status === "succeeded" && finalMedia && finalMedia.length > 0
      ? finalMedia.filter(isMediaReference)
      : [];

  const phase =
    job.status === "succeeded"
      ? ("succeeded" as const)
      : job.status === "ready_to_persist" || job.status === "uploading"
        ? ("ready_to_persist" as const)
        : ("ready_to_persist" as const);

  return {
    audios,
    invocationId: job.resultJson?.invocationId ?? job.id,
    aiInterfaceId: job.interfaceId,
    storageMode: "cloud",
    jobId: job.id,
    phase,
  };
}

export function buildVideoSubmitResponseFromJob(
  job: GenerationJobRecord
): SubmitAiVideoResponse {
  const upstreamTaskId =
    job.upstreamTaskId ??
    job.resultJson?.upstreamTaskId ??
    job.id;

  return {
    taskId: upstreamTaskId,
    invocationId: job.resultJson?.invocationId ?? job.id,
    aiInterfaceId: job.interfaceId,
    jobId: job.id,
  };
}
