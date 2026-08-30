import {
  VIDEO_DIRECT_CLIENT_POLL_INTERVAL_MS,
  VIDEO_JOB_CLIENT_POLL_INTERVAL_MS,
  type MediaReference,
  type PatchNodeLayoutMetadata,
  type SubmitAiVideoRequest,
  type SubmitAiVideoResponse,
  type WorkflowMediaValue,
} from "@dafthunk/types";

import {
  releaseGenerativeJobResume,
  tryClaimGenerativeJobResume,
} from "@/services/generative-cloud-job-resume-registry";
import {
  getGenerationJob,
  pollAiVideoTask,
  submitAiVideo,
} from "@/services/platform-ai-model-service";
import { resolveCloudGenerationJobMedia } from "@/services/persist-generative-media-from-url";
import { stageGenerativeMediaFromEphemeralUrl } from "@/services/stage-generative-media";

import { GenerativeGenerationCancelledError } from "./generative-generation-cancel";
import type { GenerativeProgressPhase } from "./generative-progress-utils";

const VIDEO_POLL_MAX_ATTEMPTS = 120;
const JOB_POLL_INTERVAL_MS = VIDEO_JOB_CLIENT_POLL_INTERVAL_MS;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export interface ResolveAiVideoJobMediaResult {
  readonly media: readonly WorkflowMediaValue[];
  readonly owned: boolean;
}

export async function pollUntilVideoReady(params: {
  readonly organizationId: string;
  readonly taskId: string;
  readonly aiInterfaceId: string;
  readonly modelCanonicalId: string;
  readonly workflowId?: string;
  readonly onPhase?: (phase: "queued" | "generating") => void;
  readonly signal?: AbortSignal;
  readonly shouldAbort?: () => boolean;
  readonly patchNodeLayout?: PatchNodeLayoutMetadata;
}): Promise<MediaReference> {
  for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (params.shouldAbort?.() || params.signal?.aborted) {
      throw new GenerativeGenerationCancelledError();
    }

    const result = await pollAiVideoTask(
      params.organizationId,
      params.taskId,
      params.aiInterfaceId,
      {
        workflowId: params.workflowId,
        modelCanonicalId: params.modelCanonicalId,
        signal: params.signal,
      }
    );
    if (result.status === "succeeded") {
      const stored = result.videos?.[0];
      if (stored) {
        return stored;
      }
      if (result.videoUrl) {
        if (!params.workflowId) {
          throw new Error("workflowId is required to stage generated video");
        }
        return stageGenerativeMediaFromEphemeralUrl({
          organizationId: params.organizationId,
          workflowId: params.workflowId,
          sourceUrl: result.videoUrl,
          mimeType: "video/mp4",
          nodeType: "ai-video",
          patchNodeLayout: params.patchNodeLayout,
        });
      }
      throw new Error("Video generation succeeded without a playable reference");
    }
    if (result.status === "cancelled") {
      throw new GenerativeGenerationCancelledError();
    }
    if (result.status === "failed" || result.status === "expired") {
      throw new Error(result.error ?? "Video generation failed");
    }
    if (result.status === "queued") {
      params.onPhase?.("queued");
    } else {
      params.onPhase?.("generating");
    }
    await sleep(VIDEO_DIRECT_CLIENT_POLL_INTERVAL_MS);
  }
  throw new Error("Video generation timed out");
}

export async function waitForAiVideoJobFinalMedia(params: {
  readonly organizationId: string;
  readonly jobId: string;
  readonly shouldAbort?: () => boolean;
}): Promise<ResolveAiVideoJobMediaResult> {
  while (true) {
    const response = await getGenerationJob(params.organizationId, params.jobId);
    if (response.job.status === "succeeded") {
      return {
        media: response.finalMedia ?? [],
        owned: false,
      };
    }
    if (response.job.status === "failed") {
      throw new Error(response.job.failureReason ?? "Generation failed");
    }
    if (response.job.status === "cancelled") {
      throw new GenerativeGenerationCancelledError();
    }
    if (params.shouldAbort?.()) {
      throw new GenerativeGenerationCancelledError();
    }
    await sleep(JOB_POLL_INTERVAL_MS);
  }
}

export async function resolveAiVideoJobMedia(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly jobId: string;
  readonly cloudConfigured: boolean;
  readonly shouldAbort?: () => boolean;
  readonly onProgressPhase?: (phase: GenerativeProgressPhase) => void;
}): Promise<ResolveAiVideoJobMediaResult> {
  const claimed = tryClaimGenerativeJobResume(params.jobId);
  if (!claimed) {
    return waitForAiVideoJobFinalMedia({
      organizationId: params.organizationId,
      jobId: params.jobId,
      shouldAbort: params.shouldAbort,
    });
  }

  try {
    const media = await resolveCloudGenerationJobMedia({
      organizationId: params.organizationId,
      jobId: params.jobId,
      workflowId: params.workflowId,
      cloudConfigured: params.cloudConfigured,
      onProgressPhase: params.onProgressPhase,
      shouldAbortJobPoll: params.shouldAbort,
    });
    return { media, owned: true };
  } finally {
    releaseGenerativeJobResume(params.jobId);
  }
}

export interface RunAiVideoGenerationAfterSubmit {
  readonly cancelled?: boolean;
  readonly completedJobId?: string;
}

export interface RunAiVideoGenerationParams {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly body: SubmitAiVideoRequest;
  readonly signal?: AbortSignal;
  readonly shouldAbort?: () => boolean;
  readonly onPhase?: (phase: "queued" | "generating", jobId?: string) => void;
  readonly applySubmitToNode?: (response: SubmitAiVideoResponse) => void;
  readonly afterSubmit?: (
    response: SubmitAiVideoResponse
  ) => Promise<RunAiVideoGenerationAfterSubmit | void>;
  readonly resolveJobMedia: (
    jobId: string
  ) => Promise<ResolveAiVideoJobMediaResult>;
  readonly patchNodeLayout?: PatchNodeLayoutMetadata;
}

export interface RunAiVideoGenerationResult {
  readonly video: MediaReference | null;
  readonly jobId: string | null;
  readonly owned: boolean;
  readonly aiInterfaceId: string;
}

export async function runAiVideoGeneration(
  params: RunAiVideoGenerationParams
): Promise<RunAiVideoGenerationResult> {
  const submitResponse = await submitAiVideo(
    params.organizationId,
    params.body,
    { signal: params.signal }
  );

  if (params.shouldAbort?.() || params.signal?.aborted) {
    throw new GenerativeGenerationCancelledError();
  }

  params.applySubmitToNode?.(submitResponse);

  const afterSubmit = await params.afterSubmit?.(submitResponse);
  if (afterSubmit?.cancelled) {
    throw new GenerativeGenerationCancelledError();
  }
  if (afterSubmit?.completedJobId) {
    const resolvedJob = await params.resolveJobMedia(afterSubmit.completedJobId);
    const video = (resolvedJob.media[0] as MediaReference | undefined) ?? null;
    if (!video) {
      throw new Error("Video generation succeeded without a playable reference");
    }
    return {
      video,
      jobId: afterSubmit.completedJobId,
      owned: resolvedJob.owned,
      aiInterfaceId: submitResponse.aiInterfaceId,
    };
  }

  if (submitResponse.jobId) {
    params.onPhase?.("generating", submitResponse.jobId);
    const resolvedJob = await params.resolveJobMedia(submitResponse.jobId);
    const video = (resolvedJob.media[0] as MediaReference | undefined) ?? null;
    if (!video) {
      throw new Error("Video generation succeeded without a playable reference");
    }
    return {
      video,
      jobId: submitResponse.jobId,
      owned: resolvedJob.owned,
      aiInterfaceId: submitResponse.aiInterfaceId,
    };
  }

  const video = await pollUntilVideoReady({
    organizationId: params.organizationId,
    taskId: submitResponse.taskId,
    aiInterfaceId: submitResponse.aiInterfaceId,
    modelCanonicalId: params.body.modelCanonicalId,
    workflowId: params.workflowId,
    onPhase: params.onPhase,
    signal: params.signal,
    shouldAbort: params.shouldAbort,
    patchNodeLayout: params.patchNodeLayout,
  });

  return {
    video,
    jobId: null,
    owned: true,
    aiInterfaceId: submitResponse.aiInterfaceId,
  };
}
