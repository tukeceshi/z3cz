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
  NEWAPI_RELAY_PROVIDER,
  resolveNewApiApiKey,
} from "./newapi-relay-upstream";
import { getUpstreamParamProfile } from "./upstream-param-profiles";
import {
  VOLCANO_VIDEO_PROVIDER,
  downloadVolcanoVideo,
  pollVolcanoVideoTask,
} from "../ai-interface/execute-volcano-video";

interface RelayTaskPollBody {
  readonly status?: string;
  readonly state?: string;
  readonly error?: string;
  readonly message?: string;
  readonly data?: {
    readonly status?: string;
    readonly output?: string;
    readonly video_url?: string;
    readonly fail_reason?: string;
  };
}

function readRelayStatus(body: RelayTaskPollBody): string {
  return (body.data?.status ?? body.status ?? body.state ?? "")
    .trim()
    .toLowerCase();
}

function readRelayVideoUrl(body: RelayTaskPollBody): string | undefined {
  const output = body.data?.output;
  if (typeof output === "string" && output.length > 0) {
    return output;
  }
  const videoUrl = body.data?.video_url;
  if (typeof videoUrl === "string" && videoUrl.length > 0) {
    return videoUrl;
  }
  return undefined;
}

function readRelayUsage(body: RelayTaskPollBody): number {
  const usage =
    (body as { usage?: number }).usage ??
    (body.data as { usage?: number } | undefined)?.usage;
  return typeof usage === "number" && usage >= 0 ? usage : 0;
}

async function finalizeRelayMediaOutput(params: {
  mediaUrl: string;
  outputName: string;
  profile: import("@dafthunk/types").UpstreamParamProfile | undefined;
  runtimeContext: UpstreamPollRuntimeContext;
  usage: number;
}): Promise<
  | import("./upstream-types").UpstreamPollCompletedResult
  | import("./upstream-types").UpstreamPollFailedResult
> {
  const { mediaUrl, outputName, profile, runtimeContext, usage } = params;
  const outputType = profile?.outputType ?? "string";

  if (outputType === "video" || outputType === "image") {
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      return {
        status: "failed",
        error: `Failed to download relay output (${response.status} ${response.statusText})`,
      };
    }

    const mimeType =
      response.headers.get("content-type") ??
      (outputType === "video" ? "video/mp4" : "image/png");
    const data = new Uint8Array(await response.arrayBuffer());
    const reference = await runtimeContext.objectStore.writeObject(
      data,
      mimeType,
      runtimeContext.organizationId,
      runtimeContext.executionId
    );

    return {
      status: "completed",
      outputs: { [outputName]: reference },
      usage,
    };
  }

  return {
    status: "completed",
    outputs: { [outputName]: mediaUrl },
    usage,
  };
}

async function pollNewApiRelayTask(params: {
  continuation: UpstreamPollContinuation;
  apiKey: string;
  runtimeContext: UpstreamPollRuntimeContext;
}): Promise<UpstreamPollResult> {
  const response = await fetch(params.continuation.pollUrl, {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 402 || response.status === 403) {
    const text = await response.text();
    return {
      status: "failed",
      error: `Upstream billing rejected request: ${response.status} ${text}`,
      usage: 0,
    };
  }

  if (!response.ok) {
    const text = await response.text();
    return {
      status: "failed",
      error: `Failed to poll relay task: ${response.status} ${text}`,
    };
  }

  const body = (await response.json()) as RelayTaskPollBody;
  const status = readRelayStatus(body);

  if (
    status === "failed" ||
    status === "error" ||
    status === "cancelled" ||
    status === "canceled"
  ) {
    return {
      status: "failed",
      error:
        body.data?.fail_reason ??
        body.error ??
        body.message ??
        "Relay task failed",
    };
  }

  if (
    status === "completed" ||
    status === "succeeded" ||
    status === "success"
  ) {
    const videoUrl = readRelayVideoUrl(body);
    if (!videoUrl) {
      return {
        status: "failed",
        error: "Relay task completed but no video URL was returned",
      };
    }

    const outputName = params.runtimeContext.nodeOutputs[0]?.name ?? "video";
    const profile = params.continuation.profileId
      ? getUpstreamParamProfile(params.continuation.profileId)
      : undefined;

    return finalizeRelayMediaOutput({
      mediaUrl: videoUrl,
      outputName,
      profile,
      runtimeContext: params.runtimeContext,
      usage: readRelayUsage(body),
    });
  }

  return {
    status: "pending",
    nextPollAt: new Date(
      Date.now() + params.continuation.pollIntervalMs
    ).toISOString(),
  };
}

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

class NewApiRelayUpstreamPollProvider implements UpstreamPollProvider {
  readonly provider = NEWAPI_RELAY_PROVIDER;

  async poll(
    continuation: UpstreamPollContinuation,
    context: UpstreamPollRuntimeContext
  ): Promise<UpstreamPollResult> {
    const relayAccountId = continuation.metadata?.relayAccountId;
    const account = context.relayAccountService
      ? await context.relayAccountService.resolve(relayAccountId, "newapi")
      : undefined;
    const apiKey =
      account?.apiKey ??
      resolveNewApiApiKey(context.env, continuation.metadata?.apiKeyEnv);

    if (!apiKey) {
      return {
        status: "failed",
        error: "NewAPI relay API key is not configured",
      };
    }

    return pollNewApiRelayTask({
      continuation,
      apiKey,
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

    const storageResolution = context.resolveAiVideoStorage
      ? await context.resolveAiVideoStorage({
          organizationId,
          workflowId: context.workflowId,
        })
      : { storageMode: "ephemeral" as const };

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
      return {
        status: "failed",
        error: downloadResult.error ?? "Failed to store generated video",
      };
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
  new NewApiRelayUpstreamPollProvider(),
  new VolcanoVideoUpstreamPollProvider(),
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
  relayAccountService?: import("../relay-account-service").RelayAccountService;
  aiInterfaceService?: import("../ai-interface-service").AiInterfaceService;
  resolveAiVideoStorage?: import("../ai-image-storage").ResolveAiImageStorage;
  workflowId?: string;
  nodeOutputs: UpstreamPollRuntimeContext["nodeOutputs"];
}): UpstreamPollRuntimeContext {
  return {
    objectStore: params.objectStore,
    organizationId: params.organizationId,
    executionId: params.executionId,
    env: params.env,
    relayAccountService: params.relayAccountService,
    aiInterfaceService: params.aiInterfaceService,
    resolveAiVideoStorage: params.resolveAiVideoStorage,
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
  relayAccountService?: import("../relay-account-service").RelayAccountService;
  aiInterfaceService?: import("../ai-interface-service").AiInterfaceService;
  resolveAiVideoStorage?: import("../ai-image-storage").ResolveAiImageStorage;
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
