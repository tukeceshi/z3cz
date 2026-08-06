import {
  buildVolcanoVideoGenerationBody,
  countSubmitAiVideoMediaReferences,
  createEphemeralMediaExpiresAt,
  type MediaReference,
  type ObjectReference,
  type VideoModelParameterRules,
  type ReferenceImageInline,
  normalizeVideoModelParameterRules,
  validateSubmitAiVideoReferences,
} from "@dafthunk/types";

import type { ObjectStore } from "../node-types";
import type { CloudImageUploadTarget } from "./execute-volcano-image";
import {
  fetchWithUpstreamLog,
  type UpstreamRequestLogSink,
} from "./upstream-request-log";

export const VOLCANO_VIDEO_PROVIDER = "volcano_video" as const;

export type VolcanoVideoStorageMode = "ephemeral" | "cloud";

export interface VolcanoVideoSubmitResult {
  readonly status: "submitted" | "failed";
  readonly taskId?: string;
  readonly pollUrl?: string;
  readonly error?: string;
}

export interface VolcanoVideoPollResult {
  readonly status: "pending" | "completed" | "failed";
  /** Present while status is pending — from upstream task status. */
  readonly upstreamPhase?: "queued" | "running";
  readonly videoUrl?: string;
  readonly error?: string;
}

export interface VolcanoVideoDownloadResult {
  readonly status: "completed" | "failed";
  readonly videos?: readonly MediaReference[];
  readonly error?: string;
  readonly storageMode?: VolcanoVideoStorageMode;
}

interface VolcanoVideoTaskResponse {
  readonly id?: string;
  readonly status?: string;
  readonly error?: { readonly message?: string };
  readonly content?: { readonly video_url?: string };
}

function inferVideoMimeType(url: string): string {
  const lower = url.split("?")[0]?.toLowerCase() ?? "";
  if (lower.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MINUTES = 60;

export function createVolcanoVideoPollContinuation(params: {
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
    provider: VOLCANO_VIDEO_PROVIDER,
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

export async function submitVolcanoVideoTask(params: {
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
  const mediaCounts = countSubmitAiVideoMediaReferences(params);
  const referenceValidation = validateSubmitAiVideoReferences({
    prompt: trimmedPrompt,
    counts: mediaCounts,
    rules,
  });
  if (!referenceValidation.ok) {
    return { status: "failed", error: referenceValidation.error };
  }

  if (
    trimmedPrompt.length > 0 &&
    trimmedPrompt.length > rules.promptMaxChars
  ) {
    return {
      status: "failed",
      error: `Prompt exceeds maximum length of ${rules.promptMaxChars} characters`,
    };
  }

  const body = buildVolcanoVideoGenerationBody({
    providerModelId: params.providerModelId,
    prompt: trimmedPrompt,
    generationFields: rules.generationFields,
    params: params.generationParams,
    referenceImageUrls: params.referenceImageUrls,
    referenceImageInline: params.referenceImageInline,
    referenceVideoUrls: params.referenceVideoUrls,
    referenceAudioUrls: params.referenceAudioUrls,
  });

  const baseUrl = params.baseUrl.replace(/\/$/, "");
  const url = `${baseUrl}/contents/generations/tasks`;

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
  let parsed: VolcanoVideoTaskResponse = {};
  try {
    parsed = JSON.parse(text) as VolcanoVideoTaskResponse;
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

  const taskId = parsed.id;
  if (!taskId) {
    return { status: "failed", error: "No task id in upstream response" };
  }

  return {
    status: "submitted",
    taskId,
    pollUrl: `${baseUrl}/contents/generations/tasks/${taskId}`,
  };
}

export async function pollVolcanoVideoTask(params: {
  readonly apiKey: string;
  readonly pollUrl: string;
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
  let parsed: VolcanoVideoTaskResponse = {};
  try {
    parsed = JSON.parse(text) as VolcanoVideoTaskResponse;
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
      error: parsed.error?.message ?? `Video task ${status}`,
    };
  }

  if (status === "succeeded" || status === "success") {
    const videoUrl = parsed.content?.video_url;
    if (!videoUrl) {
      return {
        status: "failed",
        error: "Task succeeded but no video URL was returned",
      };
    }
    return { status: "completed", videoUrl };
  }

  if (status === "queued" || status === "pending" || status === "created") {
    return { status: "pending", upstreamPhase: "queued" };
  }

  return { status: "pending", upstreamPhase: "running" };
}

export async function downloadVolcanoVideo(params: {
  readonly videoUrl: string;
  readonly storageMode: VolcanoVideoStorageMode;
  readonly objectStore?: ObjectStore;
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly executionId?: string;
  readonly cloudUpload?: CloudImageUploadTarget;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<VolcanoVideoDownloadResult> {
  const response = await fetchWithUpstreamLog(
    params.videoUrl,
    { method: "GET" },
    params.upstreamLog
  );
  if (!response.ok) {
    return {
      status: "failed",
      error: `Failed to download video (${response.status} ${response.statusText})`,
    };
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ??
    inferVideoMimeType(params.videoUrl);
  const data = new Uint8Array(await response.arrayBuffer());

  if (params.storageMode === "ephemeral") {
    if (params.objectStore) {
      const reference = await params.objectStore.writeObject(
        data,
        mimeType,
        params.organizationId,
        params.executionId
      );
      return {
        status: "completed",
        videos: [reference],
        storageMode: "cloud",
      };
    }

    const expiresAt = createEphemeralMediaExpiresAt();
    const videos: MediaReference[] = [
      {
        kind: "ephemeral",
        url: params.videoUrl,
        mimeType,
        mediaId: crypto.randomUUID(),
        expiresAt,
      },
    ];
    return { status: "completed", videos, storageMode: "ephemeral" };
  }

  if (!params.objectStore && !params.cloudUpload) {
    return {
      status: "failed",
      error: "Cloud storage is not available for persistence",
    };
  }

  const objectId = crypto.randomUUID();

  if (params.cloudUpload) {
    const reference: ObjectReference = await params.cloudUpload.upload({
      workflowId: params.workflowId?.trim() || "unknown",
      data,
      mimeType,
      objectId,
    });
    return {
      status: "completed",
      videos: [reference],
      storageMode: "cloud",
    };
  }

  const reference = await params.objectStore!.writeObject(
    data,
    mimeType,
    params.organizationId,
    params.executionId
  );

  return {
    status: "completed",
    videos: [reference],
    storageMode: "cloud",
  };
}

export async function awaitVolcanoVideoPoll(params: {
  readonly apiKey: string;
  readonly pollUrl: string;
  readonly pollIntervalMs: number;
  readonly timeoutAt: string;
}): Promise<VolcanoVideoPollResult> {
  const deadline = Date.parse(params.timeoutAt);

  while (Date.now() < deadline) {
    const result = await pollVolcanoVideoTask({
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
