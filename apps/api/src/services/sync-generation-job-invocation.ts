import type { GenerationJobRecord } from "@dafthunk/types";

import type { Database } from "../db";
import {
  cancelAiModelInvocationForGenerationJob,
  completeAiModelInvocationForGenerationJob,
  failAiModelInvocationForGenerationJob,
  finalizeAiModelInvocation,
} from "../db/platform-ai-model-queries";
import { extractFinalMediaFromJob } from "../db/generation-job-queries";

const CANCELLED_INVOCATION_CONTENT = "Generation cancelled";

function buildInvocationContent(job: GenerationJobRecord): string {
  const finalMedia = extractFinalMediaFromJob(job);
  if (finalMedia && finalMedia.length > 0) {
    return job.modality === "video"
      ? `${finalMedia.length} video(s) persisted`
      : `${finalMedia.length} image(s) persisted`;
  }

  if (job.modality === "video" && job.upstreamTaskId) {
    return `task:${job.upstreamTaskId}`;
  }

  return job.modality === "video" ? "video generation" : "image generation";
}

async function syncCancelledGenerationJobInvocation(
  db: Database,
  job: GenerationJobRecord
): Promise<void> {
  const invocationId = job.resultJson?.invocationId;
  if (invocationId) {
    await finalizeAiModelInvocation(db, {
      id: invocationId,
      organizationId: job.organizationId,
      status: "cancelled",
      content: CANCELLED_INVOCATION_CONTENT,
      error: null,
    });
    return;
  }

  await cancelAiModelInvocationForGenerationJob(db, {
    organizationId: job.organizationId,
    generationJobId: job.id,
    content: CANCELLED_INVOCATION_CONTENT,
  });
}

export async function syncGenerationJobInvocation(
  db: Database,
  job: GenerationJobRecord
): Promise<void> {
  if (job.status === "succeeded") {
    await completeAiModelInvocationForGenerationJob(db, {
      organizationId: job.organizationId,
      generationJobId: job.id,
      content: buildInvocationContent(job),
    });
    return;
  }

  if (job.status === "cancelled") {
    await syncCancelledGenerationJobInvocation(db, job);
    return;
  }

  if (job.status === "failed") {
    const error = job.failureReason ?? job.status;
    const invocationId = job.resultJson?.invocationId;
    if (invocationId) {
      await finalizeAiModelInvocation(db, {
        id: invocationId,
        organizationId: job.organizationId,
        status: "failed",
        error,
      });
      return;
    }
    await failAiModelInvocationForGenerationJob(db, {
      organizationId: job.organizationId,
      generationJobId: job.id,
      error,
    });
  }
}
