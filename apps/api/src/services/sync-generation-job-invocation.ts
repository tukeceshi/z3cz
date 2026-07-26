import type { GenerationJobRecord } from "@dafthunk/types";

import type { Database } from "../db";
import {
  completeAiModelInvocationForGenerationJob,
  failAiModelInvocationForGenerationJob,
} from "../db/platform-ai-model-queries";
import { extractFinalMediaFromJob } from "../db/generation-job-queries";

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

  if (job.status === "failed" || job.status === "cancelled") {
    await failAiModelInvocationForGenerationJob(db, {
      organizationId: job.organizationId,
      generationJobId: job.id,
      error: job.failureReason ?? job.status,
    });
  }
}
