import type { UpstreamPollContinuation } from "@dafthunk/types";

import type { NodeEnv } from "../node-types";
import type { ObjectStore } from "../object-store";
import {
  pollReplicatePrediction,
  REPLICATE_PROVIDER,
} from "./replicate-upstream";
import type {
  UpstreamPollProvider,
  UpstreamPollResult,
  UpstreamPollRuntimeContext,
} from "./upstream-types";

import {
  VOLCANO_VIDEO_PROVIDER,
  downloadVolcanoVideo,
  pollVolcanoVideoTask,
} from "../ai-interface/execute-volcano-video";
import {
  GROK_VIDEO_PROVIDER,
  downloadGrokVideo,
  pollGrokVideoTask,
} from "../ai-interface/execute-grok-video";
import {
  VEO_VIDEO_PROVIDER,
  downloadVeoVideo,
  pollVeoVideoTask,
} from "../ai-interface/execute-veo-video";

class ReplicateUpstreamPollProvider implements UpstreamPollProvider {
  readonly provider = REPLICATE_PROVIDER;

  poll(
    continuation: UpstreamPollContinuation,
    context: UpstreamPollRuntimeContext
  ): Promise<UpstreamPollResult> {
    const token = context.env.REPLICATE_API_TOKEN;
    if (!token) {
      return Promise.resolve({
        status: "failed",
        error: "REPLICATE_API_TOKEN environment variable is not configured",
      });
    }

    return pollReplicatePrediction({
      continuation,
      token,
      runtimeContext: context,
    });
  }
}

class VolcanoVideoUpstreamPollProvider implements UpstreamPollProvider {
  readonly provider = VOLCANO_VIDEO_PROVIDER;

  async poll(
    continuation: UpstreamPollContinuation,
    context: UpstreamPollRuntimeContext
  ): Promise<UpstreamPollResult> {
    const interfaceId = continuation.metadata?.interfaceId;
    const organizationId =
      continuation.metadata?.organizationId ?? context.organizationId;

    if (!interfaceId || !context.aiInterfaceService) {
      return {
        status: "failed",
        error: "Volcano video poll requires interface context",
      };
    }

    const iface = await context.aiInterfaceService.resolveOrgInterface({
      organizationId,
      interfaceId,
    });

    if (!iface?.apiKey) {
      return {
        status: "failed",
        error: "Could not resolve Volcano AI interface for video poll",
      };
    }

    const pollResult = await pollVolcanoVideoTask({
      apiKey: iface.apiKey,
      pollUrl: continuation.pollUrl,
    });

    if (pollResult.status === "failed") {
      const jobId = continuation.metadata?.generationJobId;
      if (jobId && context.trackWorkflowGenerationJob) {
        await context.trackWorkflowGenerationJob.complete({
          organizationId,
          jobId,
          status: "failed",
          failureReason: pollResult.error ?? "Video poll failed",
        });
      }
      return { status: "failed", error: pollResult.error ?? "Video poll failed" };
    }

    if (pollResult.status === "pending") {
      return {
        status: "pending",
        nextPollAt: new Date(
          Date.now() + continuation.pollIntervalMs
        ).toISOString(),
      };
    }

    if (!pollResult.videoUrl) {
      return {
        status: "failed",
        error: "Video task completed without a URL",
      };
    }

    let storageResolution: Awaited<
      ReturnType<NonNullable<typeof context.resolveAiVideoStorage>>
    >;
    try {
      storageResolution = context.resolveAiVideoStorage
        ? await context.resolveAiVideoStorage({
            organizationId,
            workflowId: context.workflowId,
          })
        : { storageMode: "ephemeral" as const };
    } catch (error) {
      return {
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Cloud storage is unavailable for video persistence",
      };
    }

    const outputName = context.nodeOutputs[0]?.name ?? "videos";
    const downloadResult = await downloadVolcanoVideo({
      videoUrl: pollResult.videoUrl,
      storageMode: storageResolution.storageMode,
      objectStore: context.objectStore,
      organizationId,
      workflowId: context.workflowId,
      executionId: context.executionId,
      cloudUpload: storageResolution.cloudUpload,
    });

    if (downloadResult.status === "failed") {
      const jobId = continuation.metadata?.generationJobId;
      if (jobId && context.trackWorkflowGenerationJob) {
        await context.trackWorkflowGenerationJob.complete({
          organizationId,
          jobId,
          status: "failed",
          failureReason:
            downloadResult.error ?? "Failed to store generated video",
        });
      }
      return {
        status: "failed",
        error: downloadResult.error ?? "Failed to store generated video",
      };
    }

    const jobId = continuation.metadata?.generationJobId;
    if (jobId && context.trackWorkflowGenerationJob) {
      await context.trackWorkflowGenerationJob.complete({
        organizationId,
        jobId,
        status: "succeeded",
      });
    }

    return {
      status: "completed",
      outputs: { [outputName]: downloadResult.videos ?? [] },
      usage: 1,
    };
  }
}

class VeoVideoUpstreamPollProvider implements UpstreamPollProvider {
  readonly provider = VEO_VIDEO_PROVIDER;

  async poll(
    continuation: UpstreamPollContinuation,
    context: UpstreamPollRuntimeContext
  ): Promise<UpstreamPollResult> {
    const interfaceId = continuation.metadata?.interfaceId;
    const organizationId =
      continuation.metadata?.organizationId ?? context.organizationId;

    if (!interfaceId || !context.aiInterfaceService) {
      return {
        status: "failed",
        error: "Veo video poll requires interface context",
      };
    }

    const iface = await context.aiInterfaceService.resolveOrgInterface({
      organizationId,
      interfaceId,
    });

    if (!iface?.apiKey) {
      return {
        status: "failed",
        error: "Could not resolve Veo AI interface for video poll",
      };
    }

    const pollResult = await pollVeoVideoTask({
      apiKey: iface.apiKey,
      pollUrl: continuation.pollUrl,
    });

    if (pollResult.status === "failed") {
      const jobId = continuation.metadata?.generationJobId;
      if (jobId && context.trackWorkflowGenerationJob) {
        await context.trackWorkflowGenerationJob.complete({
          organizationId,
          jobId,
          status: "failed",
          failureReason: pollResult.error ?? "Video poll failed",
        });
      }
      return { status: "failed", error: pollResult.error ?? "Video poll failed" };
    }

    if (pollResult.status === "pending") {
      return {
        status: "pending",
        nextPollAt: new Date(
          Date.now() + continuation.pollIntervalMs
        ).toISOString(),
      };
    }

    if (!pollResult.videoUrl) {
      return {
        status: "failed",
        error: "Video task completed without a URL",
      };
    }

    let storageResolution: Awaited<
      ReturnType<NonNullable<typeof context.resolveAiVideoStorage>>
    >;
    try {
      storageResolution = context.resolveAiVideoStorage
        ? await context.resolveAiVideoStorage({
            organizationId,
            workflowId: context.workflowId,
          })
        : { storageMode: "ephemeral" as const };
    } catch (error) {
      return {
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Cloud storage is unavailable for video persistence",
      };
    }

    const outputName = context.nodeOutputs[0]?.name ?? "videos";
    const downloadResult = await downloadVeoVideo({
      apiKey: iface.apiKey,
      videoUrl: pollResult.videoUrl,
      storageMode: storageResolution.storageMode,
      objectStore: context.objectStore,
      organizationId,
      workflowId: context.workflowId,
      executionId: context.executionId,
      cloudUpload: storageResolution.cloudUpload,
    });

    if (downloadResult.status === "failed") {
      const jobId = continuation.metadata?.generationJobId;
      if (jobId && context.trackWorkflowGenerationJob) {
        await context.trackWorkflowGenerationJob.complete({
          organizationId,
          jobId,
          status: "failed",
          failureReason:
            downloadResult.error ?? "Failed to store generated video",
        });
      }
      return {
        status: "failed",
        error: downloadResult.error ?? "Failed to store generated video",
      };
    }

    const jobId = continuation.metadata?.generationJobId;
    if (jobId && context.trackWorkflowGenerationJob) {
      await context.trackWorkflowGenerationJob.complete({
        organizationId,
        jobId,
        status: "succeeded",
      });
    }

    return {
      status: "completed",
      outputs: { [outputName]: downloadResult.videos ?? [] },
      usage: 1,
    };
  }
}

class GrokVideoUpstreamPollProvider implements UpstreamPollProvider {
  readonly provider = GROK_VIDEO_PROVIDER;

  async poll(
    continuation: UpstreamPollContinuation,
    context: UpstreamPollRuntimeContext
  ): Promise<UpstreamPollResult> {
    const interfaceId = continuation.metadata?.interfaceId;
    const organizationId =
      continuation.metadata?.organizationId ?? context.organizationId;

    if (!interfaceId || !context.aiInterfaceService) {
      return {
        status: "failed",
        error: "Grok video poll requires interface context",
      };
    }

    const iface = await context.aiInterfaceService.resolveOrgInterface({
      organizationId,
      interfaceId,
    });

    if (!iface?.apiKey) {
      return {
        status: "failed",
        error: "Could not resolve Grok AI interface for video poll",
      };
    }

    const pollResult = await pollGrokVideoTask({
      apiKey: iface.apiKey,
      pollUrl: continuation.pollUrl,
    });

    if (pollResult.status === "failed") {
      const jobId = continuation.metadata?.generationJobId;
      if (jobId && context.trackWorkflowGenerationJob) {
        await context.trackWorkflowGenerationJob.complete({
          organizationId,
          jobId,
          status: "failed",
          failureReason: pollResult.error ?? "Video poll failed",
        });
      }
      return { status: "failed", error: pollResult.error ?? "Video poll failed" };
    }

    if (pollResult.status === "pending") {
      return {
        status: "pending",
        nextPollAt: new Date(
          Date.now() + continuation.pollIntervalMs
        ).toISOString(),
      };
    }

    if (!pollResult.videoUrl) {
      return {
        status: "failed",
        error: "Video task completed without a URL",
      };
    }

    let storageResolution: Awaited<
      ReturnType<NonNullable<typeof context.resolveAiVideoStorage>>
    >;
    try {
      storageResolution = context.resolveAiVideoStorage
        ? await context.resolveAiVideoStorage({
            organizationId,
            workflowId: context.workflowId,
          })
        : { storageMode: "ephemeral" as const };
    } catch (error) {
      return {
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Cloud storage is unavailable for video persistence",
      };
    }

    const outputName = context.nodeOutputs[0]?.name ?? "videos";
    const downloadResult = await downloadGrokVideo({
      videoUrl: pollResult.videoUrl,
      storageMode: storageResolution.storageMode,
      objectStore: context.objectStore,
      organizationId,
      workflowId: context.workflowId,
      executionId: context.executionId,
      cloudUpload: storageResolution.cloudUpload,
    });

    if (downloadResult.status === "failed") {
      const jobId = continuation.metadata?.generationJobId;
      if (jobId && context.trackWorkflowGenerationJob) {
        await context.trackWorkflowGenerationJob.complete({
          organizationId,
          jobId,
          status: "failed",
          failureReason:
            downloadResult.error ?? "Failed to store generated video",
        });
      }
      return {
        status: "failed",
        error: downloadResult.error ?? "Failed to store generated video",
      };
    }

    const jobId = continuation.metadata?.generationJobId;
    if (jobId && context.trackWorkflowGenerationJob) {
      await context.trackWorkflowGenerationJob.complete({
        organizationId,
        jobId,
        status: "succeeded",
      });
    }

    return {
      status: "completed",
      outputs: { [outputName]: downloadResult.videos ?? [] },
      usage: 1,
    };
  }
}

const providers: UpstreamPollProvider[] = [
  new ReplicateUpstreamPollProvider(),
  new VolcanoVideoUpstreamPollProvider(),
  new VeoVideoUpstreamPollProvider(),
  new GrokVideoUpstreamPollProvider(),
];

export function resolveUpstreamPollProvider(
  provider: string
): UpstreamPollProvider | undefined {
  return providers.find((entry) => entry.provider === provider);
}

export function buildUpstreamPollRuntimeContext(params: {
  objectStore: ObjectStore;
  organizationId: string;
  executionId: string;
  env: NodeEnv;
  aiInterfaceService?: import("../ai-interface-service").AiInterfaceService;
  resolveAiVideoStorage?: import("../ai-image-storage").ResolveAiImageStorage;
  trackWorkflowGenerationJob?: import("../generation-job-tracker").WorkflowGenerationJobTracker;
  workflowId?: string;
  nodeOutputs: UpstreamPollRuntimeContext["nodeOutputs"];
}): UpstreamPollRuntimeContext {
  return {
    objectStore: params.objectStore,
    organizationId: params.organizationId,
    executionId: params.executionId,
    env: params.env,
    aiInterfaceService: params.aiInterfaceService,
    resolveAiVideoStorage: params.resolveAiVideoStorage,
    trackWorkflowGenerationJob: params.trackWorkflowGenerationJob,
    workflowId: params.workflowId,
    nodeOutputs: params.nodeOutputs,
  };
}

export async function pollUpstreamContinuation(params: {
  continuation: UpstreamPollContinuation;
  objectStore: ObjectStore;
  organizationId: string;
  executionId: string;
  env: NodeEnv;
  aiInterfaceService?: import("../ai-interface-service").AiInterfaceService;
  resolveAiVideoStorage?: import("../ai-image-storage").ResolveAiImageStorage;
  trackWorkflowGenerationJob?: import("../generation-job-tracker").WorkflowGenerationJobTracker;
  workflowId?: string;
  nodeOutputs: UpstreamPollRuntimeContext["nodeOutputs"];
}): Promise<UpstreamPollResult> {
  const provider = resolveUpstreamPollProvider(params.continuation.provider);
  if (!provider) {
    return {
      status: "failed",
      error: `Unsupported upstream poll provider "${params.continuation.provider}"`,
    };
  }

  return provider.poll(
    params.continuation,
    buildUpstreamPollRuntimeContext(params)
  );
}
