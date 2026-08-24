import type { SeedanceVideoCheckApiLog } from "@dafthunk/types";

import type { VolcengineCredentials } from "./client";
import {
  VOLCANO_ARK_API_VERSION,
  VOLCANO_ARK_HOST,
  VOLCANO_ARK_SERVICE,
  VOLCANO_DEFAULT_PROJECT_NAME,
  VOLCANO_DEFAULT_REGION,
} from "./constants";
import { signVolcengineRequest } from "./signature";

export interface SeedanceVideoCheckResult {
  readonly status: "pending" | "completed" | "failed";
  readonly isOfficial: boolean | null;
  readonly modelVersion: string | null;
  readonly resolution: string | null;
  readonly message: string | null;
}

export class SeedanceOfficialResultCallError extends Error {
  constructor(
    message: string,
    readonly log: SeedanceVideoCheckApiLog,
    readonly volcanoCode?: string
  ) {
    super(message);
    this.name = "SeedanceOfficialResultCallError";
  }
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mapStatus(raw: string | null): SeedanceVideoCheckResult["status"] {
  const value = raw?.toLowerCase() ?? "";
  if (value === "succeeded" || value.includes("success")) return "completed";
  if (value === "failed" || value.includes("fail")) return "failed";
  return "pending";
}

function mapOfficialFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function parseResult(raw: Record<string, unknown>): SeedanceVideoCheckResult {
  const status = mapStatus(readString(raw.Status));

  return {
    status,
    isOfficial: mapOfficialFlag(raw.IsOfficial),
    modelVersion: readString(raw.ModelVersion) ?? readString(raw.ModelName),
    resolution: readString(raw.Resolution),
    message: readString(raw.Message),
  };
}

function readVolcanoError(payload: Record<string, unknown>): {
  code: string | null;
  message: string | null;
} {
  const metadata = asRecord(payload.ResponseMetadata);
  const error = metadata ? asRecord(metadata.Error) : null;
  return {
    code: error ? readString(error.Code) : null,
    message: error ? readString(error.Message) : null,
  };
}

/** Signed fetch that keeps the full Volcano envelope (ResponseMetadata + Result). */
async function callOfficialResultApi(params: {
  readonly credentials: VolcengineCredentials;
  readonly action: string;
  readonly request: Record<string, unknown>;
}): Promise<{
  readonly log: SeedanceVideoCheckApiLog;
  readonly result: Record<string, unknown>;
}> {
  const signed = await signVolcengineRequest({
    accessKeyId: params.credentials.accessKeyId.trim(),
    secretAccessKey: params.credentials.secretAccessKey.trim(),
    region: params.credentials.region ?? VOLCANO_DEFAULT_REGION,
    service: VOLCANO_ARK_SERVICE,
    host: VOLCANO_ARK_HOST,
    method: "POST",
    action: params.action,
    version: VOLCANO_ARK_API_VERSION,
    body: params.request,
  });

  const response = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });

  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    payload = asRecord(parsed) ?? { value: parsed };
  } catch {
    payload = { parseError: "Response was not JSON" };
  }

  const log: SeedanceVideoCheckApiLog = {
    action: params.action,
    httpStatus: response.status,
    request: params.request,
    response: payload,
  };

  const volcanoError = readVolcanoError(payload);
  const metadata = asRecord(payload.ResponseMetadata);
  const hasVolcanoError = Boolean(metadata && asRecord(metadata.Error));
  if (!response.ok || hasVolcanoError) {
    throw new SeedanceOfficialResultCallError(
      volcanoError.message ?? `Volcano API ${params.action} failed (${response.status})`,
      log,
      volcanoError.code ?? undefined
    );
  }

  const result = asRecord(payload.Result) ?? payload;
  return { log, result };
}

export async function createSeedanceVideoCheckQuery(params: {
  readonly credentials: VolcengineCredentials;
  readonly videoUrl: string;
}): Promise<{ readonly queryId: string; readonly log: SeedanceVideoCheckApiLog }> {
  const { log, result } = await callOfficialResultApi({
    credentials: params.credentials,
    action: "CreateArkOfficialResultQuery",
    request: {
      Type: "content_url",
      ContentURL: params.videoUrl,
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    },
  });

  const queryId = readString(result.QueryID) ?? readString(result.QueryId);
  if (!queryId) {
    throw new SeedanceOfficialResultCallError(
      `Volcano did not return a query id: ${JSON.stringify(result)}`,
      log
    );
  }
  return { queryId, log };
}

export async function getSeedanceVideoCheckResult(params: {
  readonly credentials: VolcengineCredentials;
  readonly queryId: string;
}): Promise<
  SeedanceVideoCheckResult & {
    readonly raw: Record<string, unknown>;
    readonly log: SeedanceVideoCheckApiLog;
  }
> {
  const { log, result } = await callOfficialResultApi({
    credentials: params.credentials,
    action: "GetArkOfficialResult",
    request: {
      QueryID: params.queryId,
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    },
  });

  return {
    ...parseResult(result),
    raw: log.response,
    log,
  };
}
