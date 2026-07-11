import type {
  AiModelCatalogEntry,
  ModelActivationStatus,
  VolcanoActivationProbeResult,
} from "@dafthunk/types";

import { VOLCANO_ARK_INFERENCE_BASE_URL } from "./constants";

interface ArkErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly type?: string;
    readonly message?: string;
  };
}

export function classifyInferenceProbe(
  httpStatus: number,
  errorCode: string | undefined
): ModelActivationStatus {
  if (httpStatus === 401 || errorCode === "AuthenticationError") {
    return "auth_error";
  }
  if (errorCode === "ModelNotOpen") {
    return "not_open";
  }
  if (errorCode === "OperationDenied.ServiceNotOpen") {
    return "service_not_open";
  }
  if (errorCode === "InvalidEndpointOrModel.NotFound") {
    return "invalid_model_id";
  }
  if (httpStatus >= 200 && httpStatus < 300) {
    return "open";
  }
  if (errorCode === "InvalidParameter") {
    return "open";
  }
  if (errorCode) {
    return "open";
  }
  return "transient_error";
}

function buildProbeRequest(
  entry: AiModelCatalogEntry
): { path: string; body: Record<string, unknown> } {
  const modelId = entry.providerModelId;

  if (entry.modality === "text") {
    return {
      path: "/chat/completions",
      body: {
        model: modelId,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      },
    };
  }

  if (entry.modality === "image") {
    return {
      path: "/images/generations",
      body: {
        model: modelId,
        prompt: "probe",
        size: "1x1",
        watermark: false,
      },
    };
  }

  return {
    path: "/contents/generations/tasks",
    body: {
      model: modelId,
      content: [{ type: "text", text: "probe" }],
      duration: 0,
      ratio: "1:1",
      watermark: false,
    },
  };
}

async function postInferenceProbe(
  apiKey: string,
  path: string,
  body: Record<string, unknown>
): Promise<{ httpStatus: number; errorCode: string | undefined; message: string | null }> {
  const response = await fetch(`${VOLCANO_ARK_INFERENCE_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as ArkErrorBody;
  const errorCode = payload.error?.code;
  const message = payload.error?.message ?? null;

  return {
    httpStatus: response.status,
    errorCode,
    message,
  };
}

export async function probeVolcanoModelActivation(params: {
  apiKey: string;
  entry: AiModelCatalogEntry;
}): Promise<VolcanoActivationProbeResult> {
  const { path, body } = buildProbeRequest(params.entry);
  const { httpStatus, errorCode, message } = await postInferenceProbe(
    params.apiKey,
    path,
    body
  );

  return {
    canonicalId: params.entry.canonicalId,
    providerModelId: params.entry.providerModelId,
    status: classifyInferenceProbe(httpStatus, errorCode),
    errorCode: errorCode ?? null,
    message,
    probedAt: new Date().toISOString(),
  };
}

const PROBE_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export async function probeVolcanoModelsActivation(params: {
  apiKey: string;
  entries: readonly AiModelCatalogEntry[];
}): Promise<VolcanoActivationProbeResult[]> {
  return mapWithConcurrency(params.entries, PROBE_CONCURRENCY, (entry) =>
    probeVolcanoModelActivation({ apiKey: params.apiKey, entry })
  );
}

export function isVolcanoModelActivationBlocking(
  status: ModelActivationStatus
): boolean {
  return status === "not_open" || status === "service_not_open";
}
