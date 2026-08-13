import {
  downloadGrokVideo,
  pollGrokVideoTask,
  submitGrokVideoTask,
} from "@dafthunk/runtime/ai-interface/execute-grok-video";
import {
  downloadVeoVideo,
  pollVeoVideoTask,
  submitVeoVideoTask,
} from "@dafthunk/runtime/ai-interface/execute-veo-video";
import {
  cancelVolcanoVideoTask,
  downloadVolcanoVideo,
  pollVolcanoVideoTask,
  submitVolcanoVideoTask,
  type VolcanoVideoCancelResult,
  type VolcanoVideoDownloadResult,
  type VolcanoVideoPollResult,
  type VolcanoVideoSubmitResult,
} from "@dafthunk/runtime/ai-interface/execute-volcano-video";
import type { CloudImageUploadTarget } from "@dafthunk/runtime/ai-interface/execute-volcano-image";
import type { ObjectStore } from "@dafthunk/runtime";
import type {
  FormatTransformConfig,
  ResolvedSingleModelVideoEndpoints,
  VideoModelParameterRules,
} from "@dafthunk/types";
import {
  buildVideoPollUrl,
  isGrokImagineVideoCanonicalId,
  isVeoCanonicalId,
  resolveOfficialVideoEndpoints,
} from "@dafthunk/types";
import type { UpstreamRequestLogSink } from "@dafthunk/runtime/ai-interface/upstream-request-log";

type OrgVideoBackend = "grok" | "veo" | "volcano";

function resolveOrgVideoBackend(canonicalId: string): OrgVideoBackend {
  if (isGrokImagineVideoCanonicalId(canonicalId)) {
    return "grok";
  }
  if (isVeoCanonicalId(canonicalId)) {
    return "veo";
  }
  return "volcano";
}

export async function submitOrgVideoTask(params: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly canonicalId: string;
  readonly providerModelId: string;
  readonly prompt: string;
  readonly parameterRules: VideoModelParameterRules;
  readonly generationParams?: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: ReadonlyArray<{
    readonly mimeType: string;
    readonly dataBase64: string;
  }>;
  readonly referenceVideoUrls?: readonly string[];
  readonly referenceAudioUrls?: readonly string[];
  readonly upstreamLog?: UpstreamRequestLogSink;
  readonly videoEndpoints?: ResolvedSingleModelVideoEndpoints;
  readonly formatTransform?: FormatTransformConfig;
}): Promise<VolcanoVideoSubmitResult> {
  const backend = resolveOrgVideoBackend(params.canonicalId);

  if (backend === "grok" || backend === "veo") {
    if (
      (params.referenceImageUrls?.length ?? 0) > 0 ||
      (params.referenceImageInline?.length ?? 0) > 0 ||
      (params.referenceVideoUrls?.length ?? 0) > 0 ||
      (params.referenceAudioUrls?.length ?? 0) > 0
    ) {
      return {
        status: "failed",
        error:
          backend === "grok"
            ? "Reference media is not supported for Grok Imagine Video in this version"
            : "Reference media is not supported for Veo in this version",
      };
    }
  }

  if (backend === "grok") {
    return submitGrokVideoTask({
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
      providerModelId: params.providerModelId,
      prompt: params.prompt,
      parameterRules: params.parameterRules,
      generationParams: params.generationParams,
      upstreamLog: params.upstreamLog,
    });
  }

  if (backend === "veo") {
    return submitVeoVideoTask({
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
      providerModelId: params.providerModelId,
      prompt: params.prompt,
      parameterRules: params.parameterRules,
      generationParams: params.generationParams,
      upstreamLog: params.upstreamLog,
    });
  }

  return submitVolcanoVideoTask({
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    providerModelId: params.providerModelId,
    prompt: params.prompt,
    parameterRules: params.parameterRules,
    generationParams: params.generationParams,
    referenceImageUrls: params.referenceImageUrls,
    referenceImageInline: params.referenceImageInline,
    referenceVideoUrls: params.referenceVideoUrls,
    referenceAudioUrls: params.referenceAudioUrls,
    upstreamLog: params.upstreamLog,
    videoEndpoints: params.videoEndpoints,
    formatTransform: params.formatTransform,
  });
}

export async function pollOrgVideoTask(params: {
  readonly apiKey: string;
  readonly canonicalId: string;
  readonly baseUrl: string;
  readonly upstreamTaskId: string;
  readonly videoPollUrl?: string;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<VolcanoVideoPollResult> {
  const backend = resolveOrgVideoBackend(params.canonicalId);
  const baseUrl = params.baseUrl.replace(/\/$/, "");

  if (backend === "grok") {
    const pollUrl =
      params.videoPollUrl ?? `${baseUrl}/videos/${params.upstreamTaskId}`;
    return pollGrokVideoTask({
      apiKey: params.apiKey,
      pollUrl,
      upstreamLog: params.upstreamLog,
    });
  }

  if (backend === "veo") {
    const pollUrl =
      params.videoPollUrl ?? `${baseUrl}/${params.upstreamTaskId}`;
    return pollVeoVideoTask({
      apiKey: params.apiKey,
      pollUrl,
      upstreamLog: params.upstreamLog,
    });
  }

  return pollVolcanoVideoTask({
    apiKey: params.apiKey,
    pollUrl:
      params.videoPollUrl ??
      buildVideoPollUrl({
        baseUrl: params.baseUrl,
        submitPath:
          params.videoEndpoints?.submitPath ??
          resolveOfficialVideoEndpoints().submitPath,
        taskId: params.upstreamTaskId,
        useFullSubmitUrl: params.videoEndpoints?.useFullSubmitUrl,
      }),
    upstreamLog: params.upstreamLog,
  });
}

export async function cancelOrgVideoTask(params: {
  readonly apiKey: string;
  readonly canonicalId: string;
  readonly pollUrl: string;
  readonly videoEndpoints?: ResolvedSingleModelVideoEndpoints;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<VolcanoVideoCancelResult> {
  const backend = resolveOrgVideoBackend(params.canonicalId);

  if (backend !== "volcano") {
    return { status: "skipped" };
  }

  if (params.videoEndpoints && !params.videoEndpoints.supportsTaskCancel) {
    return { status: "skipped" };
  }

  return cancelVolcanoVideoTask({
    apiKey: params.apiKey,
    pollUrl: params.pollUrl,
    upstreamLog: params.upstreamLog,
  });
}

export async function downloadOrgVideo(params: {
  readonly apiKey: string;
  readonly canonicalId: string;
  readonly videoUrl: string;
  readonly storageMode: "ephemeral" | "cloud";
  readonly objectStore?: ObjectStore;
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly executionId?: string;
  readonly cloudUpload?: CloudImageUploadTarget;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<VolcanoVideoDownloadResult> {
  const backend = resolveOrgVideoBackend(params.canonicalId);

  if (backend === "grok") {
    return downloadGrokVideo({
      videoUrl: params.videoUrl,
      storageMode: params.storageMode,
      objectStore: params.objectStore,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      executionId: params.executionId,
      cloudUpload: params.cloudUpload,
      upstreamLog: params.upstreamLog,
    });
  }

  if (backend === "veo") {
    return downloadVeoVideo({
      apiKey: params.apiKey,
      videoUrl: params.videoUrl,
      storageMode: params.storageMode,
      objectStore: params.objectStore,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      executionId: params.executionId,
      cloudUpload: params.cloudUpload,
      upstreamLog: params.upstreamLog,
    });
  }

  return downloadVolcanoVideo({
    videoUrl: params.videoUrl,
    storageMode: params.storageMode,
    objectStore: params.objectStore,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    executionId: params.executionId,
    cloudUpload: params.cloudUpload,
    upstreamLog: params.upstreamLog,
  });
}
