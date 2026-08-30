import {
  isSubmitVideoConcatUrlsValid,
  isVideoUpstreamPollDue,
  isVolcanoMediaKitVideoTrimEnabled,
  nextVideoUpstreamPollAt,
  resolveVolcanoMediaKitFromMetadata,
  VIDEO_CONCAT_JOB_KIND,
  VIDEO_CONCAT_MODEL_CANONICAL_ID,
  VIDEO_CONCAT_MODEL_DISPLAY_NAME,
  type SubmitVideoConcatRequest,
  type VolcanoInterfaceMetadata,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase, type Database } from "../db";
import { getOrganizationAiInterfaceRow } from "../db/ai-interface-queries";
import {
  createGenerationJob,
  updateGenerationJob,
  type GenerationJobRecord,
} from "../db/generation-job-queries";
import {
  createAiModelInvocation,
  finalizeAiModelInvocation,
} from "../db/platform-ai-model-queries";
import {
  pollMediaKitTask,
  submitMediaKitVideoConcatTask,
  VolcanoMediaKitApiError,
} from "../integrations/volcengine/mediakit-client";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";
import { buildVideoPendingMedia } from "./generation-job-service";
import { createJobUpstreamRequestLogger } from "./job-upstream-request-logger";
import { markMediaResourcesFailed } from "./mark-media-resources-failed";
import { registerGeneratingPlaceholderResources } from "./register-generating-placeholder-resources";
import { resolveVolcanoMediaKitApiKey } from "./resolve-volcano-mediakit-api-key";
import {
  completeGenerationJobInvocationIfPending,
  syncGenerationJobInvocation,
} from "./sync-generation-job-invocation";

function readVolcanoMetadata(
  metadataRaw: string | null
): VolcanoInterfaceMetadata | null {
  const metadata = parseInterfaceMetadata(metadataRaw);
  return isVolcanoMetadata(metadata) ? metadata : null;
}

function assertVideoConcatEnabled(metadataRaw: string | null): void {
  const mediaKit = resolveVolcanoMediaKitFromMetadata(
    readVolcanoMetadata(metadataRaw)
  );
  if (!isVolcanoMediaKitVideoTrimEnabled(mediaKit)) {
    throw new Error("AI MediaKit video concat is not enabled on this interface");
  }
}

export async function submitVideoConcatTask(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly userId?: string;
    readonly body: SubmitVideoConcatRequest;
  }
): Promise<{
  readonly taskId: string;
  readonly jobId: string;
  readonly resourceIds: readonly string[];
  readonly aiInterfaceId: string;
}> {
  const videoUrls = params.body.videoUrls.map((url) => url.trim());
  if (!isSubmitVideoConcatUrlsValid(videoUrls)) {
    throw new Error("Invalid video concat sources");
  }

  const db = createDatabase(env);
  const row = await getOrganizationAiInterfaceRow(
    db,
    params.organizationId,
    params.body.aiInterfaceId
  );
  if (!row) {
    throw new Error("AI interface not found");
  }

  assertVideoConcatEnabled(row.metadata);

  const apiKey = await resolveVolcanoMediaKitApiKey({
    env,
    organizationId: params.organizationId,
    metadataRaw: row.metadata,
  });
  if (!apiKey) {
    throw new Error(
      "AI MediaKit API key is not configured on this interface"
    );
  }

  const jobId = crypto.randomUUID();
  const invocationId = crypto.randomUUID();
  const videoResourceIds = await registerGeneratingPlaceholderResources(db, {
    organizationId: params.organizationId,
    mimeType: "video/mp4",
    modelCanonicalId: VIDEO_CONCAT_MODEL_CANONICAL_ID,
  });

  const job = await createGenerationJob(db, {
    id: jobId,
    organizationId: params.organizationId,
    userId: params.userId,
    workflowId: params.body.workflowId,
    nodeId: params.body.nodeId,
    modality: "video",
    status: "generating",
    modelCanonicalId: VIDEO_CONCAT_MODEL_CANONICAL_ID,
    interfaceId: params.body.aiInterfaceId,
    clientRequestId: params.body.clientRequestId,
    resultJson: {
      jobKind: VIDEO_CONCAT_JOB_KIND,
      aiInterfaceId: params.body.aiInterfaceId,
      invocationId,
      placeholderResourceIds: videoResourceIds,
      nextUpstreamPollAt: new Date().toISOString(),
    },
  });

  await createAiModelInvocation(db, {
    id: invocationId,
    organizationId: params.organizationId,
    userId: params.userId,
    canonicalId: VIDEO_CONCAT_MODEL_CANONICAL_ID,
    displayName: VIDEO_CONCAT_MODEL_DISPLAY_NAME,
    interfaceId: params.body.aiInterfaceId,
    interfaceName: row.name,
    promptExcerpt: `${videoUrls.length} clips`,
    content: "",
    source: "ai-video-concat-submit",
    status: "pending",
    workflowId: params.body.workflowId,
    nodeId: params.body.nodeId,
    generationJobId: jobId,
  });

  let taskId: string;
  try {
    const submitResult = await submitMediaKitVideoConcatTask({
      apiKey,
      videoUrls,
      clientToken: params.body.clientRequestId,
      upstreamLog: createJobUpstreamRequestLogger(db, job, "submit"),
    });
    taskId = submitResult.taskId;
  } catch (error) {
    const failureReason =
      error instanceof VolcanoMediaKitApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Submit failed";
    await updateGenerationJob(db, {
      id: jobId,
      organizationId: params.organizationId,
      status: "failed",
      expectedStatuses: ["generating"],
      failureReason,
    });
    await markMediaResourcesFailed(db, {
      organizationId: params.organizationId,
      resourceIds: videoResourceIds,
      mimeType: "video/mp4",
    });
    await finalizeAiModelInvocation(db, {
      id: invocationId,
      organizationId: params.organizationId,
      status: "failed",
      error: failureReason,
    });
    throw error;
  }

  await finalizeAiModelInvocation(db, {
    id: invocationId,
    organizationId: params.organizationId,
    status: "pending",
    generationJobId: jobId,
    error: null,
  });

  await updateGenerationJob(db, {
    id: jobId,
    organizationId: params.organizationId,
    status: "generating",
    expectedStatuses: ["generating"],
    upstreamTaskId: taskId,
    resultJson: {
      jobKind: VIDEO_CONCAT_JOB_KIND,
      upstreamTaskId: taskId,
      aiInterfaceId: params.body.aiInterfaceId,
      invocationId,
      placeholderResourceIds: videoResourceIds,
      nextUpstreamPollAt: new Date().toISOString(),
    },
  });

  return {
    taskId,
    jobId,
    resourceIds: videoResourceIds,
    aiInterfaceId: params.body.aiInterfaceId,
  };
}

export async function pollVideoConcatGenerationJob(
  env: Bindings,
  db: Database,
  job: GenerationJobRecord
): Promise<GenerationJobRecord> {
  const upstreamTaskId =
    job.upstreamTaskId?.trim() ||
    job.resultJson?.upstreamTaskId?.trim() ||
    "";

  if (job.resultJson?.jobKind !== VIDEO_CONCAT_JOB_KIND || !upstreamTaskId) {
    return job;
  }

  if (job.status === "cancelled" || job.status === "failed") {
    return job;
  }

  if (job.status === "ready_to_persist") {
    await completeGenerationJobInvocationIfPending(db, job);
    return job;
  }

  if (
    (job.status === "generating" || job.status === "cancelling") &&
    !isVideoUpstreamPollDue(job.resultJson)
  ) {
    return job;
  }

  const row = await getOrganizationAiInterfaceRow(
    db,
    job.organizationId,
    job.interfaceId
  );
  if (!row) {
    const failed = await updateGenerationJob(db, {
      id: job.id,
      organizationId: job.organizationId,
      status: "failed",
      expectedStatuses: ["generating", "cancelling"],
      failureReason: "AI interface not found",
    });
    if (failed) {
      await markMediaResourcesFailed(db, {
        organizationId: failed.organizationId,
        resourceIds: failed.resultJson?.placeholderResourceIds ?? [],
        mimeType: "video/mp4",
      });
      await syncGenerationJobInvocation(db, failed);
    }
    return failed ?? job;
  }

  const apiKey = await resolveVolcanoMediaKitApiKey({
    env,
    organizationId: job.organizationId,
    metadataRaw: row.metadata,
  });
  if (!apiKey) {
    const failed = await updateGenerationJob(db, {
      id: job.id,
      organizationId: job.organizationId,
      status: "failed",
      expectedStatuses: ["generating", "cancelling"],
      failureReason: "AI MediaKit API key is not configured",
    });
    if (failed) {
      await markMediaResourcesFailed(db, {
        organizationId: failed.organizationId,
        resourceIds: failed.resultJson?.placeholderResourceIds ?? [],
        mimeType: "video/mp4",
      });
      await syncGenerationJobInvocation(db, failed);
    }
    return failed ?? job;
  }

  const pollResult = await pollMediaKitTask({
    apiKey,
    taskId: upstreamTaskId,
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
      failureReason: pollResult.error ?? "Video concat failed",
    });
    if (failed) {
      await markMediaResourcesFailed(db, {
        organizationId: failed.organizationId,
        resourceIds: failed.resultJson?.placeholderResourceIds ?? [],
        mimeType: "video/mp4",
      });
      await syncGenerationJobInvocation(db, failed);
    }
    return failed ?? job;
  }

  if (pollResult.status === "cancelled") {
    const cancelled = await updateGenerationJob(db, {
      id: job.id,
      organizationId: job.organizationId,
      status: "cancelled",
      expectedStatuses: [...activeStatuses],
    });
    if (cancelled) {
      await syncGenerationJobInvocation(db, cancelled);
    }
    return cancelled ?? job;
  }

  if (pollResult.status !== "succeeded" || !pollResult.videoUrl) {
    const upstreamVideoStatus =
      pollResult.status === "queued" ? "queued" : "running";
    return (
      (await updateGenerationJob(db, {
        id: job.id,
        organizationId: job.organizationId,
        status: job.status === "cancelling" ? "cancelling" : "generating",
        expectedStatuses: [...activeStatuses],
        resultJson: {
          ...(job.resultJson ?? {}),
          upstreamVideoStatus,
          nextUpstreamPollAt: nextVideoUpstreamPollAt(upstreamVideoStatus),
        },
      })) ?? job
    );
  }

  const pendingItem = buildVideoPendingMedia(job, pollResult.videoUrl);
  const previousResult = job.resultJson ?? {};
  const { upstreamVideoStatus: _upstreamVideoStatus, ...restResult } =
    previousResult;

  const updated = await updateGenerationJob(db, {
    id: job.id,
    organizationId: job.organizationId,
    status: "ready_to_persist",
    expectedStatuses: ["generating", "cancelling"],
    readyAt: new Date().toISOString(),
    resultJson: {
      ...restResult,
      pendingMedia: [pendingItem],
      upstreamTaskId,
      aiInterfaceId: job.interfaceId,
    },
  });

  if (updated) {
    await completeGenerationJobInvocationIfPending(db, updated);
  }

  return updated ?? job;
}
