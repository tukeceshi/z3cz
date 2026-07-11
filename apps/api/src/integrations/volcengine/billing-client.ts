import {
  VOLCANO_BILLING_API_VERSION,
  VOLCANO_BILLING_HOST,
  VOLCANO_BILLING_SERVICE,
  VOLCANO_DEFAULT_REGION,
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

export async function callVolcengineBillingApi<T>(params: {
  credentials: VolcengineCredentials;
  action: string;
  body?: Record<string, unknown>;
}): Promise<T> {
  const region = params.credentials.region ?? VOLCANO_DEFAULT_REGION;
  const signed = await signVolcengineRequest({
    accessKeyId: params.credentials.accessKeyId.trim(),
    secretAccessKey: params.credentials.secretAccessKey.trim(),
    region,
    service: VOLCANO_BILLING_SERVICE,
    host: VOLCANO_BILLING_HOST,
    method: "POST",
    action: params.action,
    version: VOLCANO_BILLING_API_VERSION,
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
        `Volcengine billing API ${params.action} failed (${response.status})`,
      error?.Code
    );
  }

  if (payload.Result !== undefined) {
    return payload.Result;
  }

  return payload as T;
}
