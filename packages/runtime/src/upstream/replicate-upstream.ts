import type { ParameterValue, UpstreamPollContinuation } from "@dafthunk/types";
import { replicateOwnerName } from "@dafthunk/types";

import { isBlobParameter, toUint8Array } from "../node-types";
import type { NodeContext } from "../node-types";
import type { ObjectStore } from "../object-store";
import type {
  UpstreamPollCompletedResult,
  UpstreamPollFailedResult,
  UpstreamPollResult,
  UpstreamPollRuntimeContext,
} from "./upstream-types";
import {
  reschedulePollContinuation,
  upstreamPollContinuation,
} from "./upstream-types";

type ReplicateOutput =
  | string
  | number
  | boolean
  | null
  | string[]
  | Record<string, unknown>
  | Record<string, unknown>[]
  | unknown[];

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: ReplicateOutput;
  error?: string;
  metrics?: {
    predict_time?: number;
  };
}

const BLOB_TYPES = new Set(["image", "audio", "video", "blob"]);
const CONFIG_INPUTS = new Set(["model", "timeout", "poll_interval"]);
const REPLICATE_CREDITS_PER_SEC = 10;

const MIME_FALLBACKS: Record<string, string> = {
  image: "image/png",
  audio: "audio/mpeg",
  video: "video/mp4",
  blob: "application/octet-stream",
};

export const REPLICATE_PROVIDER = "replicate";

async function downloadBlob(
  url: string,
  outputType: string,
  label: string
): Promise<{ data: Uint8Array; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${label} (${response.status} ${response.statusText})`
    );
  }
  const contentType = response.headers.get("content-type");
  return {
    data: new Uint8Array(await response.arrayBuffer()),
    mimeType:
      contentType ?? MIME_FALLBACKS[outputType] ?? "application/octet-stream",
  };
}

function extractOutputObject(
  output: ReplicateOutput
): Record<string, unknown> | null {
  const candidate = Array.isArray(output) ? output[0] : output;
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    return candidate as Record<string, unknown>;
  }
  return null;
}

function extractOutputUrls(output: ReplicateOutput): string[] {
  if (typeof output === "string") return [output];
  if (Array.isArray(output)) {
    return output.filter((value): value is string => typeof value === "string");
  }
  return [];
}

async function presignBlobInput(
  context: NodeContext,
  key: string,
  value: unknown,
  repeated: boolean,
  objectStore: ObjectStore
): Promise<string | string[] | undefined> {
  const presignBlob = (blob: { data: unknown; mimeType: string }) => {
    if (!context.objectStore) {
      throw new Error(
        `ObjectStore not available (required for blob input "${key}")`
      );
    }
    return objectStore.writeAndPresign(
      toUint8Array(blob.data as Uint8Array | Record<string, number>),
      blob.mimeType,
      context.organizationId
    );
  };

  if (Array.isArray(value)) {
    const pending: Array<string | Promise<string>> = [];
    for (const item of value) {
      if (isBlobParameter(item)) pending.push(presignBlob(item));
      else if (typeof item === "string" && item.length > 0) pending.push(item);
    }
    if (pending.length === 0) {
      throw new Error(
        `Input "${key}" is an array but contains no blob or URL values`
      );
    }
    return Promise.all(pending);
  }

  if (isBlobParameter(value)) {
    const url = await presignBlob(value);
    return repeated ? [url] : url;
  }

  if (typeof value === "string" && value.length > 0) {
    return repeated ? [value] : value;
  }

  return undefined;
}

export async function buildReplicateInput(
  context: NodeContext,
  nodeInputs: ReadonlyArray<{ name: string; type: string; repeated?: boolean }>,
  objectStore: ObjectStore
): Promise<Record<string, string | number | boolean | string[]>> {
  const paramByName = new Map(nodeInputs.map((parameter) => [parameter.name, parameter]));

  const entries = await Promise.all(
    Object.entries(context.inputs)
      .filter(
        ([key, value]) =>
          !CONFIG_INPUTS.has(key) && value !== undefined && value !== null
      )
      .map(async ([key, value]) => {
        const paramDef = paramByName.get(key);
        if (paramDef && BLOB_TYPES.has(paramDef.type)) {
          const presigned = await presignBlobInput(
            context,
            key,
            value,
            paramDef.repeated ?? false,
            objectStore
          );
          if (presigned !== undefined) return [key, presigned] as const;
        }
        return [key, value as string | number | boolean] as const;
      })
  );

  return Object.fromEntries(entries);
}

export interface ReplicateSubmitParams {
  readonly model: string;
  readonly timeoutMinutes: number;
  readonly pollIntervalSec: number;
}

export function parseReplicateSubmitParams(
  inputs: Record<string, unknown>
): ReplicateSubmitParams | { error: string } {
  const modelInput = inputs.model;
  if (typeof modelInput !== "string" || !modelInput.trim()) {
    return { error: "Model identifier is required (e.g., 'stability-ai/sdxl')" };
  }

  const trimmedModel = modelInput.trim();
  const ownerName = replicateOwnerName(trimmedModel).trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(ownerName)) {
    return {
      error: `Invalid model identifier "${trimmedModel}" — expected provider/model or provider/model:version`,
    };
  }

  return {
    model: trimmedModel,
    timeoutMinutes: Math.max(1, Number(inputs.timeout) || 30),
    pollIntervalSec: Math.max(1, Number(inputs.poll_interval) || 10),
  };
}

export async function submitReplicatePrediction(params: {
  model: string;
  input: Record<string, string | number | boolean | string[]>;
  token: string;
}): Promise<ReplicatePrediction | UpstreamPollFailedResult> {
  const trimmedModel = params.model.trim();
  const ownerName = replicateOwnerName(trimmedModel).trim();
  const [, rawVersion] = trimmedModel.split(":", 2);
  const version = rawVersion?.trim() || undefined;

  const predictionUrl = version
    ? "https://api.replicate.com/v1/predictions"
    : `https://api.replicate.com/v1/models/${ownerName}/predictions`;

  const body = version
    ? { version, input: params.input }
    : { input: params.input };

  const response = await fetch(predictionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      status: "failed",
      error: `Failed to create Replicate prediction: ${response.status} ${text}`,
    };
  }

  return (await response.json()) as ReplicatePrediction;
}

export function createReplicatePollContinuation(params: {
  nodeId: string;
  predictionId: string;
  pollIntervalMs: number;
  timeoutMinutes: number;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const timeoutAt = new Date(
    now.getTime() + params.timeoutMinutes * 60_000
  ).toISOString();

  return upstreamPollContinuation({
    nodeId: params.nodeId,
    provider: REPLICATE_PROVIDER,
    taskId: params.predictionId,
    pollUrl: `https://api.replicate.com/v1/predictions/${params.predictionId}`,
    pollIntervalMs: params.pollIntervalMs,
    timeoutAt,
    now,
    nextPollAt: now.toISOString(),
  });
}

async function finalizeReplicateOutputs(
  output: ReplicateOutput,
  predictTime: number | undefined,
  context: UpstreamPollRuntimeContext
): Promise<UpstreamPollCompletedResult> {
  const usage =
    predictTime !== undefined && predictTime > 0
      ? Math.max(1, Math.round(predictTime * REPLICATE_CREDITS_PER_SEC))
      : 1;

  const multiResult = await tryProcessMultiOutput(output, context, usage);
  if (multiResult) {
    return multiResult;
  }

  const declaredOutputs = context.nodeOutputs;
  const primary = declaredOutputs[0];
  const primaryName = primary?.name ?? "output";
  const primaryType = primary?.type ?? "any";
  const isRepeated = primary?.repeated === true;
  const outputUrls = extractOutputUrls(output);

  if (BLOB_TYPES.has(primaryType) && outputUrls.length > 0) {
    const blobs = await Promise.all(
      outputUrls.map((url, index) =>
        downloadBlob(url, primaryType, `${primaryName}-${index}`)
      )
    );
    return {
      status: "completed",
      outputs: {
        [primaryName]: isRepeated ? blobs : blobs[0],
      },
      usage,
    };
  }

  if (outputUrls.length > 0) {
    return {
      status: "completed",
      outputs: {
        [primaryName]: isRepeated ? outputUrls : outputUrls[0],
      },
      usage,
    };
  }

  return {
    status: "completed",
    outputs: { [primaryName]: output as ParameterValue },
    usage,
  };
}

async function tryProcessMultiOutput(
  output: ReplicateOutput,
  context: UpstreamPollRuntimeContext,
  usage: number
): Promise<UpstreamPollCompletedResult | null> {
  if (context.nodeOutputs.length <= 1) return null;

  const obj = extractOutputObject(output);
  if (!obj) return null;

  const entries = await Promise.all(
    context.nodeOutputs.map(
      async (
        outputDef
      ): Promise<readonly [string, ParameterValue] | null> => {
        const value = obj[outputDef.name];
        if (value === undefined || value === null) return null;

        if (BLOB_TYPES.has(outputDef.type)) {
          if (typeof value !== "string") return null;
          return [
            outputDef.name,
            await downloadBlob(value, outputDef.type, outputDef.name),
          ];
        }
        return [outputDef.name, value as ParameterValue];
      }
    )
  );

  const results = Object.fromEntries(
    entries.filter((entry): entry is readonly [string, ParameterValue] => entry !== null)
  );

  if (Object.keys(results).length === 0) {
    return null;
  }

  return {
    status: "completed",
    outputs: results,
    usage,
  };
}

export async function pollReplicatePrediction(params: {
  continuation: import("@dafthunk/types").UpstreamPollContinuation;
  token: string;
  runtimeContext: UpstreamPollRuntimeContext;
}): Promise<import("./upstream-types").UpstreamPollResult> {
  const response = await fetch(params.continuation.pollUrl, {
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      status: "failed",
      error: `Failed to poll Replicate prediction: ${response.status} ${text}`,
    };
  }

  const result = (await response.json()) as ReplicatePrediction;

  if (result.status === "failed") {
    return {
      status: "failed",
      error: `Replicate prediction failed: ${result.error || "Unknown error"}`,
    };
  }

  if (result.status === "canceled") {
    return { status: "failed", error: "Replicate prediction was canceled" };
  }

  if (result.status !== "succeeded") {
    return {
      status: "pending",
      nextPollAt: new Date(
        Date.now() + params.continuation.pollIntervalMs
      ).toISOString(),
    };
  }

  if (result.output === undefined || result.output === null) {
    return {
      status: "failed",
      error: "Replicate prediction succeeded but no output was returned",
    };
  }

  return finalizeReplicateOutputs(
    result.output,
    result.metrics?.predict_time,
    params.runtimeContext
  );
}

/**
 * Blocking poll loop for WorkerRuntime (no durable heartbeat).
 * Returns when the prediction completes, fails, or times out.
 */
export async function awaitReplicatePrediction(params: {
  continuation: UpstreamPollContinuation;
  token: string;
  runtimeContext: UpstreamPollRuntimeContext;
}): Promise<UpstreamPollResult> {
  const deadline = Date.parse(params.continuation.timeoutAt);
  let continuation = params.continuation;

  while (Date.now() < deadline) {
    const result = await pollReplicatePrediction({
      continuation,
      token: params.token,
      runtimeContext: params.runtimeContext,
    });

    if (result.status !== "pending") {
      return result;
    }

    const sleepMs = Math.max(500, Date.parse(result.nextPollAt) - Date.now());
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
    continuation = reschedulePollContinuation(
      continuation,
      new Date(Date.now() + continuation.pollIntervalMs)
    );
  }

  return {
    status: "failed",
    error: "Replicate prediction timed out before completion",
  };
}
