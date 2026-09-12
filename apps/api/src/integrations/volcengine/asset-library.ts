import { VOLCANO_DEFAULT_PROJECT_NAME } from "./constants";
import {
  callVolcengineArkApi,
  type VolcengineCredentials,
} from "./client";

export type VolcanoAssetStatus = "pending" | "active" | "failed";

export interface VolcanoAssetRequestLogSink {
  (record: {
    readonly method: string;
    readonly url: string;
    readonly httpStatus: number | null;
    readonly durationMs: number;
    readonly requestBody?: unknown;
    readonly responseExcerpt?: string;
    readonly error?: string;
  }): Promise<void>;
}

export interface VolcanoAssetState {
  readonly assetId: string;
  readonly status: VolcanoAssetStatus;
}

function readResultId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  for (const key of ["AssetId", "Id", "GroupId"]) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function readAssetStatus(result: unknown): VolcanoAssetStatus | null {
  if (!result || typeof result !== "object") return null;
  const value = (result as Record<string, unknown>)["Status"];
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "failed") return "failed";
  return "pending";
}

/* ------------------------------------------------------------------ *
 * Standalone gateway mode (single-model API key, e.g. relay gateways)
 * POST {gateway}/volc/asset/* with Authorization: Bearer <apiKey>.
 * ------------------------------------------------------------------ */

export interface StandaloneAssetContext {
  readonly gatewayOrigin: string;
  readonly apiKey: string;
}

async function callStandaloneAssetApi<T>(
  params: {
    readonly context: StandaloneAssetContext;
    readonly action: string;
    readonly body: Record<string, unknown>;
  },
  requestLogSink?: VolcanoAssetRequestLogSink
): Promise<T> {
  const url = `${params.context.gatewayOrigin}/volc/asset/${params.action}`;
  const startedAt = Date.now();
  let httpStatus: number | null = null;
  let responseExcerpt: string | undefined;
  let errorMessage: string | undefined;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.context.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params.body),
    });
    httpStatus = response.status;
    const text = await response.text();
    responseExcerpt = text.slice(0, 500);
    let payload: unknown = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        (payload &&
          typeof payload === "object" &&
          ((payload as Record<string, unknown>).error ??
            (payload as Record<string, unknown>).message)) ||
        `Gateway ${params.action} failed (${response.status})`;
      errorMessage = String(message);
      throw new Error(errorMessage);
    }
    // Gateway wraps upstream failures in HTTP 200 + {error: {...}}.
    if (
      payload &&
      typeof payload === "object" &&
      payload !== null &&
      "error" in (payload as Record<string, unknown>)
    ) {
      const errorPayload = (payload as Record<string, unknown>)["error"];
      errorMessage =
        typeof errorPayload === "object" && errorPayload !== null
          ? String(
              (errorPayload as Record<string, unknown>)["message"] ??
                JSON.stringify(errorPayload)
            )
          : String(errorPayload);
      throw new Error(errorMessage);
    }
    return payload as T;
  } catch (error) {
    if (!errorMessage && error instanceof Error) {
      errorMessage = error.message;
    }
    throw error;
  } finally {
    if (requestLogSink) {
      try {
        await requestLogSink({
          method: "POST",
          url,
          httpStatus,
          durationMs: Date.now() - startedAt,
          requestBody: params.body,
          responseExcerpt,
          error: errorMessage,
        });
      } catch {
        // Logging must never break the import flow.
      }
    }
  }
}

export async function createStandaloneAssetGroup(params: {
  readonly context: StandaloneAssetContext;
  readonly name: string;
  readonly requestLogSink?: VolcanoAssetRequestLogSink;
}): Promise<string> {
  const payload = await callStandaloneAssetApi<Record<string, unknown>>(
    {
      context: params.context,
      action: "CreateAssetGroup",
      body: { model: "volc-asset", Name: params.name },
    },
    params.requestLogSink
  );
  const groupId = readResultId(payload);
  if (!groupId) {
    throw new Error("CreateAssetGroup returned no group id");
  }
  return groupId;
}

export async function createStandaloneAsset(params: {
  readonly context: StandaloneAssetContext;
  readonly groupId: string;
  readonly url: string;
  readonly name: string;
  readonly requestLogSink?: VolcanoAssetRequestLogSink;
}): Promise<string> {
  const payload = await callStandaloneAssetApi<Record<string, unknown>>(
    {
      context: params.context,
      action: "CreateAsset",
      body: {
        model: "volc-asset",
        GroupId: params.groupId,
        Name: params.name,
        AssetType: "Image",
        URL: params.url,
      },
    },
    params.requestLogSink
  );
  const assetId = readResultId(payload);
  if (!assetId) {
    throw new Error("CreateAsset returned no asset id");
  }
  return assetId;
}

export async function getStandaloneAssetStatus(params: {
  readonly context: StandaloneAssetContext;
  readonly assetId: string;
  readonly requestLogSink?: VolcanoAssetRequestLogSink;
}): Promise<VolcanoAssetState> {
  const payload = await callStandaloneAssetApi<Record<string, unknown>>(
    {
      context: params.context,
      action: "GetAsset",
      body: {
        model: "volc-asset",
        Id: params.assetId,
      },
    },
    params.requestLogSink
  );
  const status = readAssetStatus(payload);
  if (!status) {
    throw new Error("GetAsset returned no status");
  }
  return { assetId: params.assetId, status };
}

/* ------------------------------------------------------------------ *
 * Aggregate mode (Volcano IAM AK/SK signed OpenAPI).
 * ------------------------------------------------------------------ */

/** Create the per-org asset group in the Volcano private asset library. */
export async function createVolcanoAssetGroup(params: {
  readonly credentials: VolcengineCredentials;
  readonly name: string;
  readonly requestLogSink?: VolcanoAssetRequestLogSink;
}): Promise<string> {
  const result = await callVolcengineArkApi<Record<string, unknown>>({
    credentials: params.credentials,
    action: "CreateAssetGroup",
    body: {
      Name: params.name,
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    },
    requestLogSink: params.requestLogSink,
  });
  const groupId = readResultId(result);
  if (!groupId) {
    throw new Error("Volcano CreateAssetGroup returned no group id");
  }
  return groupId;
}

/**
 * Submit an asset import by URL (async upstream processing).
 * The URL must be fetchable by Volcano — reuse the same resolution as
 * video generation reference submission.
 */
export async function createVolcanoAsset(params: {
  readonly credentials: VolcengineCredentials;
  readonly groupId: string;
  readonly url: string;
  readonly name: string;
  readonly requestLogSink?: VolcanoAssetRequestLogSink;
}): Promise<string> {
  const result = await callVolcengineArkApi<Record<string, unknown>>({
    credentials: params.credentials,
    action: "CreateAsset",
    body: {
      GroupId: params.groupId,
      Name: params.name,
      AssetType: "Image",
      URL: params.url,
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    },
    requestLogSink: params.requestLogSink,
  });
  const assetId = readResultId(result);
  if (!assetId) {
    throw new Error("Volcano CreateAsset returned no asset id");
  }
  return assetId;
}

/** Query asset import status (upstream pre-processing). */
export async function getVolcanoAssetStatus(params: {
  readonly credentials: VolcengineCredentials;
  readonly assetId: string;
  readonly requestLogSink?: VolcanoAssetRequestLogSink;
}): Promise<VolcanoAssetState> {
  const result = await callVolcengineArkApi<Record<string, unknown>>({
    credentials: params.credentials,
    action: "GetAsset",
    body: {
      AssetId: params.assetId,
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    },
    requestLogSink: params.requestLogSink,
  });
  const status = readAssetStatus(result);
  if (!status) {
    throw new Error("Volcano GetAsset returned no status");
  }
  return { assetId: params.assetId, status };
}
