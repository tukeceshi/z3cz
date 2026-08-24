import type {
  GetSeedanceVideoCheckResultResponse,
  SeedanceVideoCheckApiLog,
  SeedanceVideoCheckErrorResponse,
  SubmitSeedanceVideoCheckRequest,
  SubmitSeedanceVideoCheckResponse,
} from "@dafthunk/types";

import { buildApiUrl } from "@/config/api";

function toolsEndpoint(organizationId: string): string {
  return `/${organizationId}/tools/seedance-video-check`;
}

export class SeedanceVideoCheckRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: SeedanceVideoCheckErrorResponse | unknown
  ) {
    super(message);
    this.name = "SeedanceVideoCheckRequestError";
  }
}

async function requestSeedanceCheck<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(buildApiUrl(endpoint), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errorBody = body as SeedanceVideoCheckErrorResponse | null;
    const message =
      errorBody?.error ??
      (typeof body === "object" && body !== null && "message" in body
        ? String((body as { message?: unknown }).message)
        : `Request failed with status: ${response.status}`);
    throw new SeedanceVideoCheckRequestError(message, response.status, body);
  }

  return body as T;
}

export async function submitSeedanceVideoCheck(
  organizationId: string,
  body: SubmitSeedanceVideoCheckRequest
): Promise<SubmitSeedanceVideoCheckResponse> {
  return requestSeedanceCheck<SubmitSeedanceVideoCheckResponse>(
    `${toolsEndpoint(organizationId)}/submit`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function fetchSeedanceVideoCheckResult(
  organizationId: string,
  queryId: string
): Promise<GetSeedanceVideoCheckResultResponse> {
  const params = new URLSearchParams({ queryId });
  return requestSeedanceCheck<GetSeedanceVideoCheckResultResponse>(
    `${toolsEndpoint(organizationId)}/result?${params.toString()}`
  );
}

export function formatSeedanceVideoCheckErrorDetail(error: unknown): string {
  if (error instanceof SeedanceVideoCheckRequestError) {
    return JSON.stringify(
      {
        status: error.status,
        message: error.message,
        body: error.body,
      },
      null,
      2
    );
  }

  if (error instanceof Error) {
    return JSON.stringify(
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      null,
      2
    );
  }

  return JSON.stringify(error, null, 2);
}

export function readSeedanceVideoCheckErrorLog(
  error: unknown
): SeedanceVideoCheckApiLog | null {
  if (!(error instanceof SeedanceVideoCheckRequestError)) return null;
  if (!error.body || typeof error.body !== "object") return null;
  const log = (error.body as SeedanceVideoCheckErrorResponse).log;
  if (!log || typeof log !== "object") return null;
  if (typeof log.action !== "string") return null;
  return log;
}
