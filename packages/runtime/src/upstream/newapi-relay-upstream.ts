import type { UpstreamParamProfile } from "@dafthunk/types";

import type { NodeEnv } from "../node-types";
import {
  getUpstreamParamProfile,
  resolvePollUrl,
} from "./upstream-param-profiles";
import { upstreamPollContinuation } from "./upstream-types";

export const NEWAPI_RELAY_PROVIDER = "newapi";

export interface NewApiRelaySubmitResult {
  readonly taskId: string;
  readonly pollUrl: string;
}

export function createNewApiRelayPollContinuation(params: {
  nodeId: string;
  taskId: string;
  pollUrl: string;
  pollIntervalMs: number;
  timeoutMinutes: number;
  profileId?: string;
  relayAccountId?: string;
  apiKeyEnv?: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const timeoutAt = new Date(
    now.getTime() + params.timeoutMinutes * 60_000
  ).toISOString();

  return upstreamPollContinuation({
    nodeId: params.nodeId,
    provider: NEWAPI_RELAY_PROVIDER,
    taskId: params.taskId,
    pollUrl: params.pollUrl,
    pollIntervalMs: params.pollIntervalMs,
    timeoutAt,
    now,
    nextPollAt: now.toISOString(),
    metadata: {
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.relayAccountId
        ? { relayAccountId: params.relayAccountId }
        : {}),
      ...(params.apiKeyEnv ? { apiKeyEnv: params.apiKeyEnv } : {}),
    },
  });
}

/** Parses common NewAPI relay create-task responses. */
export function parseNewApiRelaySubmitResponse(
  body: Record<string, unknown>,
  pollUrlBase: string
): NewApiRelaySubmitResult | { error: string } {
  const data =
    body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : body;

  const taskId =
    (typeof data.task_id === "string" && data.task_id) ||
    (typeof data.id === "string" && data.id) ||
    (typeof data.taskId === "string" && data.taskId);

  if (!taskId) {
    return { error: "Relay create-task response did not include a task id" };
  }

  const pollUrl =
    (typeof data.poll_url === "string" && data.poll_url) ||
    (typeof data.status_url === "string" && data.status_url) ||
    `${pollUrlBase.replace(/\/$/, "")}/${taskId}`;

  return { taskId, pollUrl };
}

export function resolveNewApiBaseUrl(env: NodeEnv): string | undefined {
  const baseUrl = env.NEWAPI_BASE_URL;
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    return undefined;
  }
  return baseUrl.trim().replace(/\/$/, "");
}

export function resolveNewApiApiKey(
  env: NodeEnv,
  apiKeyEnv?: string
): string | undefined {
  if (apiKeyEnv) {
    const envRecord = env as unknown as Record<string, string | undefined>;
    const value = envRecord[apiKeyEnv];
    if (typeof value === "string") {
      return value;
    }
  }
  const apiKey = env.NEWAPI_API_KEY;
  return typeof apiKey === "string" && apiKey.length > 0 ? apiKey : undefined;
}

export async function readUpstreamErrorMessage(
  response: Response
): Promise<string> {
  const text = await response.text();
  if (!text) {
    return response.statusText || "Upstream request failed";
  }

  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    const nestedError = body.error;
    const message =
      (typeof body.message === "string" && body.message) ||
      (typeof body.error === "string" && body.error) ||
      (nestedError &&
        typeof nestedError === "object" &&
        typeof (nestedError as { message?: string }).message === "string" &&
        (nestedError as { message: string }).message);
    if (message) {
      return `${response.status} ${message}`;
    }
  } catch {
    // fall through to raw text
  }

  return `${response.status} ${text}`;
}

export async function submitNewApiRelayTask(params: {
  profile: UpstreamParamProfile;
  body: Record<string, unknown>;
  baseUrl: string;
  apiKey: string;
}): Promise<
  | { taskId: string; pollUrl: string }
  | { error: string; usage?: number }
> {
  const createUrl = `${params.baseUrl}${params.profile.createPath.startsWith("/") ? params.profile.createPath : `/${params.profile.createPath}`}`;

  const response = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.body),
  });

  if (
    response.status === 402 ||
    response.status === 403 ||
    response.status === 400
  ) {
    return {
      error: await readUpstreamErrorMessage(response),
      usage: 0,
    };
  }

  if (!response.ok) {
    return { error: await readUpstreamErrorMessage(response) };
  }

  let parsedBody: Record<string, unknown>;
  try {
    parsedBody = (await response.json()) as Record<string, unknown>;
  } catch {
    return { error: "Relay create-task response was not valid JSON" };
  }

  const pollUrlBase = `${params.baseUrl}${params.profile.pollPathTemplate.replace("{taskId}", "")}`.replace(/\/$/, "");
  const parsed = parseNewApiRelaySubmitResponse(parsedBody, pollUrlBase);
  if ("error" in parsed) {
    return parsed;
  }

  return {
    taskId: parsed.taskId,
    pollUrl: resolvePollUrl(
      params.baseUrl,
      params.profile,
      parsed.taskId,
      parsed.pollUrl
    ),
  };
}

export function buildRelayPollContinuation(params: {
  nodeId: string;
  profile: UpstreamParamProfile;
  taskId: string;
  pollUrl: string;
  pollIntervalSec: number;
  timeoutMinutes: number;
  relayAccountId?: string;
  apiKeyEnv?: string;
  now?: Date;
}) {
  return createNewApiRelayPollContinuation({
    nodeId: params.nodeId,
    taskId: params.taskId,
    pollUrl: params.pollUrl,
    pollIntervalMs: params.pollIntervalSec * 1000,
    timeoutMinutes: params.timeoutMinutes,
    profileId: params.profile.id,
    relayAccountId: params.relayAccountId,
    apiKeyEnv: params.apiKeyEnv,
    now: params.now,
  });
}

export function resolveRelayProfile(
  profileId: string | undefined
): UpstreamParamProfile | { error: string } {
  const resolvedId = profileId?.trim() || "seedance-2.0-t2v-official-v1";
  const profile = getUpstreamParamProfile(resolvedId);
  if (!profile) {
    return { error: `Unknown upstream param profile "${resolvedId}"` };
  }
  return profile;
}
