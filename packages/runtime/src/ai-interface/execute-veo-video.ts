import type { VideoModelParameterRules } from "@dafthunk/types";
import { normalizeVideoModelParameterRules } from "@dafthunk/types";

import {
  downloadVolcanoVideo,
  type VolcanoVideoDownloadResult,
  type VolcanoVideoPollResult,
  type VolcanoVideoSubmitResult,
} from "./execute-volcano-video";

export const VEO_VIDEO_PROVIDER = "veo_video" as const;

interface VeoSubmitResponse {
  readonly name?: string;
  readonly error?: { readonly message?: string };
}

interface VeoOperationResponse {
  readonly done?: boolean;
  readonly error?: { readonly message?: string };
  readonly response?: {
    readonly generateVideoResponse?: {
      readonly generatedSamples?: ReadonlyArray<{
        readonly video?: { readonly uri?: string };
      }>;
    };
  };
}

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MINUTES = 60;

function buildVeoPollUrl(baseUrl: string, operationName: string): string {
  const base = baseUrl.replace(/\/$/, "");
  if (operationName.startsWith("http://") || operationName.startsWith("https://")) {
    return operationName;
  }
  if (operationName.startsWith("/")) {
    return `${base}${operationName}`;
  }
  return `${base}/${operationName}`;
}

function buildVeoParameters(
  generationParams?: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const parameters: Record<string, unknown> = { sampleCount: 1 };

  if (!generationParams) {
    return parameters;
  }

  const ratio = generationParams.ratio ?? generationParams.aspectRatio;
  if (typeof ratio === "string" && ratio.trim().length > 0) {
    parameters.aspectRatio = ratio.trim();
  }

  const resolution = generationParams.resolution;
  if (typeof resolution === "string" && resolution.trim().length > 0) {
    parameters.resolution = resolution.trim();
  }

  return parameters;
}

export function createVeoVideoPollContinuation(params: {
  nodeId: string;
  taskId: string;
  pollUrl: string;
  interfaceId: string;
  organizationId: string;
  pollIntervalMs?: number;
  timeoutMinutes?: number;
  generationJobId?: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const timeoutAt = new Date(
    now.getTime() + (params.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES) * 60_000
  ).toISOString();

  return {
    kind: "upstream_poll" as const,
    nodeId: params.nodeId,
    provider: VEO_VIDEO_PROVIDER,
    taskId: params.taskId,
    pollUrl: params.pollUrl,
    pollIntervalMs: params.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    nextPollAt: new Date(
      now.getTime() + (params.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
    ).toISOString(),
    timeoutAt,
    createdAt: now.toISOString(),
    metadata: {
      interfaceId: params.interfaceId,
      organizationId: params.organizationId,
      ...(params.generationJobId
        ? { generationJobId: params.generationJobId }
        : {}),
    },
  };
}

export async function submitVeoVideoTask(params: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly providerModelId: string;
  readonly prompt: string;
  readonly parameterRules: VideoModelParameterRules;
  readonly generationParams?: Readonly<Record<string, unknown>>;
}): Promise<VolcanoVideoSubmitResult> {
  const rules = normalizeVideoModelParameterRules(params.parameterRules);
  const trimmedPrompt = params.prompt.trim();

  if (!trimmedPrompt) {
    return { status: "failed", error: "Prompt is required" };
  }

  if (trimmedPrompt.length > rules.promptMaxChars) {
    return {
      status: "failed",
      error: `Prompt exceeds maximum length of ${rules.promptMaxChars} characters`,
    };
  }

  const baseUrl = params.baseUrl.replace(/\/$/, "");
  const url = `${baseUrl}/models/${params.providerModelId}:predictLongRunning`;
  const body = {
    instances: [{ prompt: trimmedPrompt }],
    parameters: buildVeoParameters(params.generationParams),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": params.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: VeoSubmitResponse = {};
  try {
    parsed = JSON.parse(text) as VeoSubmitResponse;
  } catch {
    return {
      status: "failed",
      error: `Upstream returned non-JSON response (${response.status})`,
    };
  }

  if (!response.ok) {
    return {
      status: "failed",
      error:
        parsed.error?.message ??
        `Upstream request failed (${response.status}): ${text.slice(0, 300)}`,
    };
  }

  const operationName = parsed.name?.trim();
  if (!operationName) {
    return { status: "failed", error: "No operation name in upstream response" };
  }

  return {
    status: "submitted",
    taskId: operationName,
    pollUrl: buildVeoPollUrl(baseUrl, operationName),
  };
}

export async function pollVeoVideoTask(params: {
  readonly apiKey: string;
  readonly pollUrl: string;
}): Promise<VolcanoVideoPollResult> {
  const response = await fetch(params.pollUrl, {
    headers: {
      "x-goog-api-key": params.apiKey,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  let parsed: VeoOperationResponse = {};
  try {
    parsed = JSON.parse(text) as VeoOperationResponse;
  } catch {
    return {
      status: "failed",
      error: `Upstream returned non-JSON response (${response.status})`,
    };
  }

  if (!response.ok) {
    return {
      status: "failed",
      error:
        parsed.error?.message ??
        `Poll request failed (${response.status}): ${text.slice(0, 300)}`,
    };
  }

  if (!parsed.done) {
    return { status: "pending", upstreamPhase: "running" };
  }

  if (parsed.error?.message) {
    return { status: "failed", error: parsed.error.message };
  }

  const videoUrl =
    parsed.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!videoUrl) {
    return {
      status: "failed",
      error: "Operation completed but no video URL was returned",
    };
  }

  return { status: "completed", videoUrl };
}

export async function awaitVeoVideoPoll(params: {
  readonly apiKey: string;
  readonly pollUrl: string;
  readonly pollIntervalMs: number;
  readonly timeoutAt: string;
}): Promise<VolcanoVideoPollResult> {
  const deadline = Date.parse(params.timeoutAt);

  while (Date.now() < deadline) {
    const result = await pollVeoVideoTask({
      apiKey: params.apiKey,
      pollUrl: params.pollUrl,
    });

    if (result.status !== "pending") {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, params.pollIntervalMs));
  }

  return { status: "failed", error: "Video generation timed out" };
}

export async function downloadVeoVideo(params: {
  readonly apiKey: string;
  readonly videoUrl: string;
  readonly storageMode: "ephemeral" | "cloud";
  readonly objectStore?: import("../node-types").ObjectStore;
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly executionId?: string;
  readonly cloudUpload?: import("./execute-volcano-image").CloudImageUploadTarget;
}): Promise<VolcanoVideoDownloadResult> {
  const downloadUrl = new URL(params.videoUrl);
  if (!downloadUrl.searchParams.has("key")) {
    downloadUrl.searchParams.set("key", params.apiKey);
  }

  return downloadVolcanoVideo({
    videoUrl: downloadUrl.toString(),
    storageMode: params.storageMode,
    objectStore: params.objectStore,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    executionId: params.executionId,
    cloudUpload: params.cloudUpload,
  });
}

export { downloadVolcanoVideo };
