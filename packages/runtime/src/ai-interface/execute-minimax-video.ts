import type {
  ReferenceImageInline,
  VideoModelParameterRules,
} from "@dafthunk/types";
import {
  buildVideoSubmitContent,
  mapVideoGenerationFieldsToBody,
  MINIMAX_VIDEO_POLL_PATH,
  MINIMAX_VIDEO_SUBMIT_PATH,
  normalizeVideoModelParameterRules,
} from "@dafthunk/types";

import {
  downloadVolcanoVideo,
  type VolcanoVideoCancelResult,
  type VolcanoVideoDownloadResult,
  type VolcanoVideoPollResult,
  type VolcanoVideoSubmitResult,
} from "./execute-volcano-video";
import {
  fetchWithUpstreamLog,
  type UpstreamRequestLogSink,
} from "./upstream-request-log";

export const MINIMAX_VIDEO_PROVIDER = "minimax_video" as const;

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MINUTES = 60;

interface MinimaxBaseResponse {
  readonly status_code?: number;
  readonly status_msg?: string;
}

interface MinimaxVideoTask {
  readonly id?: string;
  readonly status?: string;
  readonly content?: {
    readonly url?: string;
  };
}

interface MinimaxVideoSubmitResponse {
  readonly task?: MinimaxVideoTask;
  readonly base_resp?: MinimaxBaseResponse;
}

interface MinimaxVideoPollResponse {
  readonly task?: MinimaxVideoTask;
  readonly base_resp?: MinimaxBaseResponse;
}

function readMinimaxTaskStatus(task: MinimaxVideoTask | undefined): string {
  return (task?.status ?? "").trim().toLowerCase();
}

function readMinimaxTaskVideoUrl(task: MinimaxVideoTask | undefined): string {
  return task?.content?.url?.trim() ?? "";
}

function isMinimaxSuccess(baseResp: MinimaxBaseResponse | undefined): boolean {
  return baseResp?.status_code === undefined || baseResp.status_code === 0;
}

function minimaxErrorMessage(
  baseResp: MinimaxBaseResponse | undefined,
  fallback: string
): string {
  return baseResp?.status_msg?.trim() || fallback;
}

function buildMinimaxVideoBody(params: {
  readonly providerModelId: string;
  readonly prompt: string;
  readonly parameterRules: VideoModelParameterRules;
  readonly generationParams?: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly referenceVideoUrls?: readonly string[];
  readonly referenceAudioUrls?: readonly string[];
}): Record<string, unknown> {
  const rules = normalizeVideoModelParameterRules(params.parameterRules);
  const body: Record<string, unknown> = {
    model: params.providerModelId,
    content: buildVideoSubmitContent({
      prompt: params.prompt,
      generationFields: rules.generationFields,
      params: params.generationParams,
      referenceImageUrls: params.referenceImageUrls,
      referenceImageInline: params.referenceImageInline,
      referenceVideoUrls: params.referenceVideoUrls,
      referenceAudioUrls: params.referenceAudioUrls,
    }),
  };

  mapVideoGenerationFieldsToBody({
    generationFields: rules.generationFields,
    params: params.generationParams,
    target: body,
    omitAdaptiveRatio: true,
  });

  return body;
}

function buildMinimaxPollUrl(baseUrl: string, taskId: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return `${normalizedBaseUrl}${MINIMAX_VIDEO_POLL_PATH}/${encodeURIComponent(taskId)}`;
}

export function buildMinimaxVideoCancelUrl(
  baseUrl: string,
  taskId: string
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return `${normalizedBaseUrl}${MINIMAX_VIDEO_SUBMIT_PATH}/${encodeURIComponent(taskId)}`;
}

export function createMinimaxVideoPollContinuation(params: {
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
    provider: MINIMAX_VIDEO_PROVIDER,
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

export async function submitMinimaxVideoTask(params: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly providerModelId: string;
  readonly prompt: string;
  readonly parameterRules: VideoModelParameterRules;
  readonly generationParams?: Readonly<Record<string, unknown>>;
  readonly referenceImageUrls?: readonly string[];
  readonly referenceImageInline?: readonly ReferenceImageInline[];
  readonly referenceVideoUrls?: readonly string[];
  readonly referenceAudioUrls?: readonly string[];
  readonly upstreamLog?: UpstreamRequestLogSink;
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
  const url = `${baseUrl}${MINIMAX_VIDEO_SUBMIT_PATH}`;
  const body = buildMinimaxVideoBody({
    providerModelId: params.providerModelId,
    prompt: trimmedPrompt,
    parameterRules: params.parameterRules,
    generationParams: params.generationParams,
    referenceImageUrls: params.referenceImageUrls,
    referenceImageInline: params.referenceImageInline,
    referenceVideoUrls: params.referenceVideoUrls,
    referenceAudioUrls: params.referenceAudioUrls,
  });

  const response = await fetchWithUpstreamLog(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    params.upstreamLog
  );

  const text = await response.text();
  let parsed: MinimaxVideoSubmitResponse = {};
  try {
    parsed = JSON.parse(text) as MinimaxVideoSubmitResponse;
  } catch {
    return {
      status: "failed",
      error: `Upstream returned non-JSON response (${response.status})`,
    };
  }

  if (!response.ok || !isMinimaxSuccess(parsed.base_resp)) {
    return {
      status: "failed",
      error: minimaxErrorMessage(
        parsed.base_resp,
        `Upstream request failed (${response.status}): ${text.slice(0, 300)}`
      ),
    };
  }

  const taskId = parsed.task?.id?.trim();
  if (!taskId) {
    return { status: "failed", error: "No task.id in upstream response" };
  }

  return {
    status: "submitted",
    taskId,
    pollUrl: buildMinimaxPollUrl(baseUrl, taskId),
  };
}

export async function pollMinimaxVideoTask(params: {
  readonly apiKey: string;
  readonly pollUrl: string;
  readonly baseUrl?: string;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<VolcanoVideoPollResult> {
  const response = await fetchWithUpstreamLog(
    params.pollUrl,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
    },
    params.upstreamLog
  );

  const text = await response.text();
  let parsed: MinimaxVideoPollResponse = {};
  try {
    parsed = JSON.parse(text) as MinimaxVideoPollResponse;
  } catch {
    return {
      status: "failed",
      error: `Upstream returned non-JSON response (${response.status})`,
    };
  }

  if (!response.ok || !isMinimaxSuccess(parsed.base_resp)) {
    return {
      status: "failed",
      error: minimaxErrorMessage(
        parsed.base_resp,
        `Poll request failed (${response.status}): ${text.slice(0, 300)}`
      ),
    };
  }

  const task = parsed.task;
  if (!task) {
    return {
      status: "failed",
      error: "No task in upstream response",
    };
  }

  const status = readMinimaxTaskStatus(task);

  if (status === "fail" || status === "failed") {
    return {
      status: "failed",
      error: minimaxErrorMessage(parsed.base_resp, "Video request failed"),
    };
  }

  if (status === "success" || status === "succeeded") {
    const videoUrl = readMinimaxTaskVideoUrl(task);
    if (!videoUrl) {
      return {
        status: "failed",
        error: "Request completed but no video URL was returned",
      };
    }

    return { status: "completed", videoUrl };
  }

  if (status === "queued") {
    return { status: "pending", upstreamPhase: "queued" };
  }

  return { status: "pending", upstreamPhase: "running" };
}

export async function cancelMinimaxVideoTask(params: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly taskId: string;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<VolcanoVideoCancelResult> {
  const url = buildMinimaxVideoCancelUrl(params.baseUrl, params.taskId);

  const response = await fetchWithUpstreamLog(
    url,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
    },
    params.upstreamLog
  );

  if (response.status === 204 || (response.status >= 200 && response.status < 300)) {
    return { status: "cancelled" };
  }

  const text = await response.text();
  let parsed: { readonly base_resp?: MinimaxBaseResponse } = {};
  try {
    parsed = JSON.parse(text) as { readonly base_resp?: MinimaxBaseResponse };
  } catch {
    parsed = {};
  }

  if (isMinimaxSuccess(parsed.base_resp)) {
    return { status: "cancelled" };
  }

  return {
    status: "failed",
    error: minimaxErrorMessage(
      parsed.base_resp,
      `Cancel request failed (${response.status}): ${text.slice(0, 300)}`
    ),
  };
}

export async function awaitMinimaxVideoPoll(params: {
  readonly apiKey: string;
  readonly pollUrl: string;
  readonly baseUrl?: string;
  readonly pollIntervalMs: number;
  readonly timeoutAt: string;
}): Promise<VolcanoVideoPollResult> {
  const deadline = Date.parse(params.timeoutAt);

  while (Date.now() < deadline) {
    const result = await pollMinimaxVideoTask({
      apiKey: params.apiKey,
      pollUrl: params.pollUrl,
      baseUrl: params.baseUrl,
    });

    if (result.status !== "pending") {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, params.pollIntervalMs));
  }

  return { status: "failed", error: "Video generation timed out" };
}

export async function downloadMinimaxVideo(params: {
  readonly videoUrl: string;
  readonly storageMode: "ephemeral" | "cloud";
  readonly objectStore?: import("../node-types").ObjectStore;
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly executionId?: string;
  readonly cloudUpload?: import("./execute-volcano-image").CloudImageUploadTarget;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<VolcanoVideoDownloadResult> {
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
