import {
  VOLCANO_ARK_API_VERSION,
  VOLCANO_ARK_HOST,
  VOLCANO_ARK_SERVICE,
  VOLCANO_DEFAULT_REGION,
} from "./constants";
import { signVolcengineRequest } from "./signature";

export interface VolcengineCredentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region?: string;
}

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

export class VolcengineApiRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = "VolcengineApiRequestError";
  }
}

export async function callVolcengineArkApi<T>(params: {
  credentials: VolcengineCredentials;
  action: string;
  body?: Record<string, unknown>;
  queryParams?: Record<string, string>;
  requestLogSink?: (record: {
    readonly method: string;
    readonly url: string;
    readonly httpStatus: number | null;
    readonly durationMs: number;
    readonly requestBody?: unknown;
    readonly responseExcerpt?: string;
    readonly error?: string;
  }) => Promise<void>;
}): Promise<T> {
  const region = params.credentials.region ?? VOLCANO_DEFAULT_REGION;
  const signed = await signVolcengineRequest({
    accessKeyId: params.credentials.accessKeyId.trim(),
    secretAccessKey: params.credentials.secretAccessKey.trim(),
    region,
    service: VOLCANO_ARK_SERVICE,
    host: VOLCANO_ARK_HOST,
    method: "POST",
    action: params.action,
    version: VOLCANO_ARK_API_VERSION,
    body: params.body,
    queryParams: params.queryParams,
  });

  const startedAt = Date.now();
  let httpStatus: number | null = null;
  let responseExcerpt: string | undefined;
  let errorMessage: string | undefined;

  try {
    const response = await fetch(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: signed.body,
    });
    httpStatus = response.status;
    const payloadText = await response.text();
    responseExcerpt = payloadText.slice(0, 500);
    const payload = JSON.parse(payloadText) as VolcengineResponse<T> & T;
    const error = payload.ResponseMetadata?.Error;
    if (!response.ok || error) {
      errorMessage =
        error?.Message ??
        `Volcengine API ${params.action} failed (${response.status})`;
      throw new VolcengineApiRequestError(errorMessage, error?.Code);
    }

    if (payload.Result !== undefined) {
      return payload.Result;
    }

    return payload as T;
  } catch (error) {
    if (!errorMessage && error instanceof Error) {
      errorMessage = error.message;
    }
    throw error;
  } finally {
    if (params.requestLogSink) {
      try {
        await params.requestLogSink({
          method: "POST",
          url: signed.url,
          httpStatus,
          durationMs: Date.now() - startedAt,
          requestBody: params.body,
          responseExcerpt,
          error: errorMessage,
        });
      } catch {
        // Logging must never break the caller.
      }
    }
  }
}
