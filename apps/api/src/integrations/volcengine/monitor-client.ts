import {
  VOLCANO_DEFAULT_REGION,
  VOLCANO_MONITOR_API_VERSION,
  VOLCANO_MONITOR_HOST,
  VOLCANO_MONITOR_SERVICE,
} from "./constants";
import type { VolcengineCredentials } from "./client";
import { VolcengineApiRequestError } from "./client";
import { signVolcengineRequest } from "./signature";

interface VolcengineApiError {
  readonly Code?: string;
  readonly Message?: string;
}

interface VolcengineResponse<T> {
  readonly ResponseMetadata?: {
    readonly Error?: VolcengineApiError;
    readonly RequestId?: string;
  };
  readonly Result?: T;
}

export async function callVolcengineMonitorApi<T>(params: {
  credentials: VolcengineCredentials;
  action: string;
  body?: Record<string, unknown>;
  region?: string;
}): Promise<T> {
  const region = params.region ?? params.credentials.region ?? VOLCANO_DEFAULT_REGION;
  const signed = await signVolcengineRequest({
    accessKeyId: params.credentials.accessKeyId.trim(),
    secretAccessKey: params.credentials.secretAccessKey.trim(),
    region,
    service: VOLCANO_MONITOR_SERVICE,
    host: VOLCANO_MONITOR_HOST,
    method: "POST",
    action: params.action,
    version: VOLCANO_MONITOR_API_VERSION,
    body: params.body,
  });

  const response = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });

  const payload = (await response.json()) as VolcengineResponse<T> & T;
  const error = payload.ResponseMetadata?.Error;
  if (!response.ok || error) {
    throw new VolcengineApiRequestError(
      error?.Message ??
        `Volcengine monitor API ${params.action} failed (${response.status})`,
      error?.Code
    );
  }

  if (payload.Result !== undefined) {
    return payload.Result;
  }

  return payload as T;
}
