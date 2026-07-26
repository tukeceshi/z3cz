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
  downloadVolcanoVideo,
  pollVolcanoVideoTask,
  submitVolcanoVideoTask,
  type VolcanoVideoDownloadResult,
  type VolcanoVideoPollResult,
  type VolcanoVideoSubmitResult,
} from "@dafthunk/runtime/ai-interface/execute-volcano-video";
import type { CloudImageUploadTarget } from "@dafthunk/runtime/ai-interface/execute-volcano-image";
import type { ObjectStore } from "@dafthunk/runtime";
import {
  isGrokImagineVideoCanonicalId,
  isVeoCanonicalId,
  type VideoModelParameterRules,
} from "@dafthunk/types";

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
}): Promise<VolcanoVideoSubmitResult> {
  const backend = resolveOrgVideoBackend(params.canonicalId);

  if (backend === "grok" || backend === "veo") {
    if (
      (params.referenceImageUrls?.length ?? 0) > 0 ||
      (params.referenceImageInline?.length ?? 0) > 0
    ) {
      return {
        status: "failed",
        error:
          backend === "grok"
            ? "Reference images are not supported for Grok Imagine Video in this version"
            : "Reference images are not supported for Veo in this version",
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
  });
}

export async function pollOrgVideoTask(params: {
  readonly apiKey: string;
  readonly canonicalId: string;
  readonly baseUrl: string;
  readonly upstreamTaskId: string;
  readonly videoPollUrl?: string;
}): Promise<VolcanoVideoPollResult> {
  const backend = resolveOrgVideoBackend(params.canonicalId);
  const baseUrl = params.baseUrl.replace(/\/$/, "");

  if (backend === "grok") {
    const pollUrl =
      params.videoPollUrl ?? `${baseUrl}/videos/${params.upstreamTaskId}`;
    return pollGrokVideoTask({
      apiKey: params.apiKey,
      pollUrl,
    });
  }

  if (backend === "veo") {
    const pollUrl =
      params.videoPollUrl ?? `${baseUrl}/${params.upstreamTaskId}`;
    return pollVeoVideoTask({
      apiKey: params.apiKey,
      pollUrl,
    });
  }

  return pollVolcanoVideoTask({
    apiKey: params.apiKey,
    pollUrl: `${baseUrl}/contents/generations/tasks/${params.upstreamTaskId}`,
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
  });
}
