import type { VolcanoMediaKitVideoEnhanceMode } from "@dafthunk/types";
import {
  fetchWithUpstreamLog,
  type UpstreamRequestLogSink,
} from "@dafthunk/runtime/ai-interface/upstream-request-log";

export const VOLCANO_MEDIKIT_API_HOST = "amk.cn-beijing.volces.com" as const;
export const VOLCANO_MEDIKIT_API_BASE_URL =
  `https://${VOLCANO_MEDIKIT_API_HOST}` as const;

const MODE_ENDPOINTS: Readonly<
  Record<VolcanoMediaKitVideoEnhanceMode, string>
> = {
  fast: "/api/v1/tools/enhance-video-fast",
  standard: "/api/v1/tools/enhance-video",
  pro: "/api/v1/tools/enhance-video",
  llm: "/api/v1/tools/enhance-video-generative",
};

export class VolcanoMediaKitApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number
  ) {
    super(message);
    this.name = "VolcanoMediaKitApiError";
  }
}

interface MediaKitTaskSubmitResponse {
  readonly success?: boolean;
  readonly task_id?: string;
  readonly error?: unknown;
  readonly message?: string;
}

interface MediaKitTaskQueryResponse {
  readonly success?: boolean;
  readonly task_id?: string;
  readonly status?: string;
  readonly error?: unknown;
  readonly message?: string;
  readonly result?: {
    readonly video_url?: string;
    readonly url?: string;
  };
}

function readErrorMessage(payload: MediaKitTaskSubmitResponse): string {
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  if (
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  return "MediaKit request failed";
}

function mapMediaKitTerminalStatus(
  status: string | undefined
): PollVideoEnhanceMappedStatus {
  const normalized = status?.trim().toLowerCase();
  switch (normalized) {
    case "completed":
    case "succeeded":
    case "success":
      return "succeeded";
    case "failed":
      return "failed";
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "queued":
      return "queued";
    default:
      return "running";
  }
}

function readMediaKitVideoUrl(
  payload: MediaKitTaskQueryResponse
): string | undefined {
  return (
    payload.result?.video_url?.trim() ||
    payload.result?.url?.trim() ||
    undefined
  );
}

export function resolveMediaKitPollOutcome(
  payload: MediaKitTaskQueryResponse,
  httpOk: boolean
): {
  readonly status: PollVideoEnhanceMappedStatus;
  readonly videoUrl?: string;
  readonly error?: string;
} {
  if (!httpOk) {
    return {
      status: "failed",
      error: readErrorMessage(payload),
    };
  }

  if (payload.success === false) {
    return {
      status: "failed",
      error: readErrorMessage(payload),
    };
  }

  const videoUrl = readMediaKitVideoUrl(payload);
  const mapped = mapMediaKitTerminalStatus(payload.status);

  if (mapped === "failed") {
    return {
      status: "failed",
      error: readErrorMessage(payload),
    };
  }

  if (mapped === "cancelled") {
    return { status: "cancelled" };
  }

  if (videoUrl && (mapped === "succeeded" || payload.success === true)) {
    return { status: "succeeded", videoUrl };
  }

  if (mapped === "succeeded") {
    return {
      status: "failed",
      error: "MediaKit task completed without video_url",
    };
  }

  if (mapped === "queued") {
    return { status: "queued" };
  }

  return { status: "running" };
}

export type PollVideoEnhanceMappedStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface SubmitMediaKitVideoEnhanceParams {
  readonly apiKey: string;
  readonly videoUrl: string;
  readonly mode: VolcanoMediaKitVideoEnhanceMode;
  readonly resolution: string;
  readonly fps: number;
  readonly clientToken?: string;
  readonly upstreamLog?: UpstreamRequestLogSink;
}

export async function submitMediaKitVideoEnhanceTask(
  params: SubmitMediaKitVideoEnhanceParams
): Promise<{ readonly taskId: string }> {
  const path = MODE_ENDPOINTS[params.mode];
  const body: Record<string, unknown> = {
    video_url: params.videoUrl,
    resolution: params.resolution,
    fps: params.fps,
  };

  if (params.clientToken) {
    body.client_token = params.clientToken;
  }
  if (params.mode === "standard") {
    body.tool_version = "standard";
  }
  if (params.mode === "pro") {
    body.tool_version = "professional";
  }

  const response = await fetchWithUpstreamLog(
    `${VOLCANO_MEDIKIT_API_BASE_URL}${path}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    },
    params.upstreamLog
  );

  const payload = (await response.json()) as MediaKitTaskSubmitResponse;
  if (!response.ok || payload.success === false) {
    throw new VolcanoMediaKitApiError(
      readErrorMessage(payload),
      response.status
    );
  }

  const taskId = payload.task_id?.trim();
  if (!taskId) {
    throw new VolcanoMediaKitApiError("MediaKit submit did not return task_id");
  }

  return { taskId };
}

export async function pollMediaKitVideoEnhanceTask(params: {
  readonly apiKey: string;
  readonly taskId: string;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<{
  readonly status: PollVideoEnhanceMappedStatus;
  readonly videoUrl?: string;
  readonly error?: string;
}> {
  return pollMediaKitTask(params);
}

export interface SubmitMediaKitVideoTrimParams {
  readonly apiKey: string;
  readonly videoUrl: string;
  readonly startSec: number;
  readonly endSec: number;
  readonly clientToken?: string;
  readonly upstreamLog?: UpstreamRequestLogSink;
}

export async function submitMediaKitVideoTrimTask(
  params: SubmitMediaKitVideoTrimParams
): Promise<{ readonly taskId: string }> {
  const body: Record<string, unknown> = {
    video_url: params.videoUrl,
    start_time: params.startSec,
    end_time: params.endSec,
  };

  if (params.clientToken) {
    body.client_token = params.clientToken;
  }

  const response = await fetchWithUpstreamLog(
    `${VOLCANO_MEDIKIT_API_BASE_URL}/api/v1/tools/trim-video`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    },
    params.upstreamLog
  );

  const payload = (await response.json()) as MediaKitTaskSubmitResponse;
  if (!response.ok || payload.success === false) {
    throw new VolcanoMediaKitApiError(
      readErrorMessage(payload),
      response.status
    );
  }

  const taskId = payload.task_id?.trim();
  if (!taskId) {
    throw new VolcanoMediaKitApiError("MediaKit submit did not return task_id");
  }

  return { taskId };
}

export interface SubmitMediaKitVideoConcatParams {
  readonly apiKey: string;
  readonly videoUrls: readonly string[];
  readonly clientToken?: string;
  readonly upstreamLog?: UpstreamRequestLogSink;
}

export async function submitMediaKitVideoConcatTask(
  params: SubmitMediaKitVideoConcatParams
): Promise<{ readonly taskId: string }> {
  const body: Record<string, unknown> = {
    video_urls: [...params.videoUrls],
  };

  if (params.clientToken) {
    body.client_token = params.clientToken;
  }

  const response = await fetchWithUpstreamLog(
    `${VOLCANO_MEDIKIT_API_BASE_URL}/api/v1/tools/concat-video`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    },
    params.upstreamLog
  );

  const payload = (await response.json()) as MediaKitTaskSubmitResponse;
  if (!response.ok || payload.success === false) {
    throw new VolcanoMediaKitApiError(
      readErrorMessage(payload),
      response.status
    );
  }

  const taskId = payload.task_id?.trim();
  if (!taskId) {
    throw new VolcanoMediaKitApiError("MediaKit submit did not return task_id");
  }

  return { taskId };
}

export async function pollMediaKitTask(params: {
  readonly apiKey: string;
  readonly taskId: string;
  readonly upstreamLog?: UpstreamRequestLogSink;
}): Promise<{
  readonly status: PollVideoEnhanceMappedStatus;
  readonly videoUrl?: string;
  readonly error?: string;
}> {
  const response = await fetchWithUpstreamLog(
    `${VOLCANO_MEDIKIT_API_BASE_URL}/api/v1/tasks/${encodeURIComponent(params.taskId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${params.apiKey.trim()}`,
      },
    },
    params.upstreamLog
  );

  const payload = (await response.json()) as MediaKitTaskQueryResponse;
  return resolveMediaKitPollOutcome(payload, response.ok);
}
