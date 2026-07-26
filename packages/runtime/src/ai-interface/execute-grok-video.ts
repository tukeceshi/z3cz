import type { VideoModelParameterRules } from "@dafthunk/types";
import { normalizeVideoModelParameterRules } from "@dafthunk/types";

import {
  downloadVolcanoVideo,
  type VolcanoVideoDownloadResult,
  type VolcanoVideoPollResult,
  type VolcanoVideoSubmitResult,
} from "./execute-volcano-video";

export const GROK_VIDEO_PROVIDER = "grok_video" as const;

interface GrokVideoSubmitResponse {
  readonly request_id?: string;
  readonly error?: { readonly message?: string };
}

interface GrokVideoPollResponse {
  readonly status?: string;
  readonly video?: { readonly url?: string };
  readonly error?: { readonly message?: string };
}

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MINUTES = 60;

function buildGrokVideoBody(params: {
  readonly providerModelId: string;
  readonly prompt: string;
  readonly generationParams?: Readonly<Record<string, unknown>>;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.providerModelId,
    prompt: params.prompt.trim(),
  };

  if (!params.generationParams) {
    return body;
  }

  const ratio = params.generationParams.ratio ?? params.generationParams.aspect_ratio;
  if (typeof ratio === "string" && ratio.trim().length > 0) {
    body.aspect_ratio = ratio.trim();
  }

  const duration = params.generationParams.duration;
  if (typeof duration === "number" && Number.isFinite(duration)) {
    body.duration = duration;
  }

  const resolution = params.generationParams.resolution;
  if (typeof resolution === "string" && resolution.trim().length > 0) {
    body.resolution = resolution.trim();
  }

  return body;
}

export function createGrokVideoPollContinuation(params: {
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
    provider: GROK_VIDEO_PROVIDER,
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

export async function submitGrokVideoTask(params: {
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
  const url = `${baseUrl}/videos/generations`;
  const body = buildGrokVideoBody({
    providerModelId: params.providerModelId,
    prompt: trimmedPrompt,
    generationParams: params.generationParams,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: GrokVideoSubmitResponse = {};
  try {
    parsed = JSON.parse(text) as GrokVideoSubmitResponse;
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

  const requestId = parsed.request_id?.trim();
  if (!requestId) {
    return { status: "failed", error: "No request_id in upstream response" };
  }

  return {
    status: "submitted",
    taskId: requestId,
    pollUrl: `${baseUrl}/videos/${requestId}`,
  };
}

export async function pollGrokVideoTask(params: {
  readonly apiKey: string;
  readonly pollUrl: string;
}): Promise<VolcanoVideoPollResult> {
  const response = await fetch(params.pollUrl, {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  let parsed: GrokVideoPollResponse = {};
  try {
    parsed = JSON.parse(text) as GrokVideoPollResponse;
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

  const status = (parsed.status ?? "").trim().toLowerCase();

  if (status === "failed" || status === "expired") {
    return {
      status: "failed",
      error: parsed.error?.message ?? `Video request ${status}`,
    };
  }

  if (status === "done" || status === "succeeded" || status === "success") {
    const videoUrl = parsed.video?.url;
    if (!videoUrl) {
      return {
        status: "failed",
        error: "Request completed but no video URL was returned",
      };
    }
    return { status: "completed", videoUrl };
  }

  return { status: "pending" };
}

export async function awaitGrokVideoPoll(params: {
  readonly apiKey: string;
  readonly pollUrl: string;
  readonly pollIntervalMs: number;
  readonly timeoutAt: string;
}): Promise<VolcanoVideoPollResult> {
  const deadline = Date.parse(params.timeoutAt);

  while (Date.now() < deadline) {
    const result = await pollGrokVideoTask({
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

export async function downloadGrokVideo(params: {
  readonly videoUrl: string;
  readonly storageMode: "ephemeral" | "cloud";
  readonly objectStore?: import("../node-types").ObjectStore;
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly executionId?: string;
  readonly cloudUpload?: import("./execute-volcano-image").CloudImageUploadTarget;
}): Promise<VolcanoVideoDownloadResult> {
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
