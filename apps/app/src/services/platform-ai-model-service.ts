import type {
  CompleteGenerationJobUploadRequest,
  CompleteGenerationJobUploadResponse,
  GenerateAiAudioRequest,
  GenerateAiAudioResponse,
  GenerateAiImageRequest,
  GenerateAiImageResponse,
  GenerateAiTextRequest,
  GenerateAiTextResponse,
  GetGenerationJobResponse,
  ListAiModelInvocationsResponse,
  ListOrgAudioModelsResponse,
  ListOrgImageModelsResponse,
  ListOrgTextModelsResponse,
  ListOrgVideoModelsResponse,
  OrgCloudStorageConfiguredStatus,
  OrgCloudStorageStatus,
  PollAiVideoTaskResponse,
  SubmitAiVideoRequest,
  SubmitAiVideoResponse,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

function platformAiEndpoint(organizationId: string): string {
  return `/${organizationId}/platform-ai`;
}

const ORG_MODELS_SWR_OPTIONS = {
  revalidateOnFocus: false,
  dedupingInterval: 0,
} as const;

export function useOrgTextModels(
  orgId: string | undefined,
  options?: { readonly enabled?: boolean }
) {
  const enabled = options?.enabled !== false;
  const key =
    orgId && enabled ? `${platformAiEndpoint(orgId)}/text-models` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    async () => makeRequest<ListOrgTextModelsResponse>(`${key}`),
    ORG_MODELS_SWR_OPTIONS
  );

  return {
    models: data?.models ?? [],
    groups: data?.groups ?? [],
    modelsError: error,
    isLoading: !data && isLoading,
    refreshModels: mutate,
  };
}

export function useOrgImageModels(
  orgId: string | undefined,
  options?: { readonly enabled?: boolean }
) {
  const enabled = options?.enabled !== false;
  const key =
    orgId && enabled ? `${platformAiEndpoint(orgId)}/image-models` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    async () => makeRequest<ListOrgImageModelsResponse>(`${key}`),
    ORG_MODELS_SWR_OPTIONS
  );

  return {
    models: data?.models ?? [],
    groups: data?.groups ?? [],
    modelsError: error,
    isLoading: !data && isLoading,
    refreshModels: mutate,
  };
}

export function useOrgVideoModels(
  orgId: string | undefined,
  options?: { readonly enabled?: boolean }
) {
  const enabled = options?.enabled !== false;
  const key =
    orgId && enabled ? `${platformAiEndpoint(orgId)}/video-models` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    async () => makeRequest<ListOrgVideoModelsResponse>(`${key}`),
    ORG_MODELS_SWR_OPTIONS
  );

  return {
    models: data?.models ?? [],
    groups: data?.groups ?? [],
    modelsError: error,
    isLoading: !data && isLoading,
    refreshModels: mutate,
  };
}

export function useOrgAudioModels(
  orgId: string | undefined,
  options?: { readonly enabled?: boolean }
) {
  const enabled = options?.enabled !== false;
  const key =
    orgId && enabled ? `${platformAiEndpoint(orgId)}/audio-models` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    async () => makeRequest<ListOrgAudioModelsResponse>(`${key}`),
    ORG_MODELS_SWR_OPTIONS
  );

  return {
    models: data?.models ?? [],
    groups: data?.groups ?? [],
    modelsError: error,
    isLoading: !data && isLoading,
    refreshModels: mutate,
  };
}

export async function resolveOrgImageModel(
  orgId: string,
  canonicalId: string,
  interfaceId: string
): Promise<{ aiInterfaceId: string; providerModelId: string }> {
  const query = new URLSearchParams({ aiInterfaceId: interfaceId });
  return makeRequest<{ aiInterfaceId: string; providerModelId: string }>(
    `${platformAiEndpoint(orgId)}/image-models/${encodeURIComponent(canonicalId)}/resolve?${query.toString()}`
  );
}

export async function resolveOrgVideoModel(
  orgId: string,
  canonicalId: string,
  interfaceId: string
): Promise<{ aiInterfaceId: string; providerModelId: string }> {
  const query = new URLSearchParams({ aiInterfaceId: interfaceId });
  return makeRequest<{ aiInterfaceId: string; providerModelId: string }>(
    `${platformAiEndpoint(orgId)}/video-models/${encodeURIComponent(canonicalId)}/resolve?${query.toString()}`
  );
}

export async function resolveOrgAudioModel(
  orgId: string,
  canonicalId: string,
  interfaceId: string
): Promise<{ aiInterfaceId: string; providerModelId: string }> {
  const query = new URLSearchParams({ aiInterfaceId: interfaceId });
  return makeRequest<{ aiInterfaceId: string; providerModelId: string }>(
    `${platformAiEndpoint(orgId)}/audio-models/${encodeURIComponent(canonicalId)}/resolve?${query.toString()}`
  );
}

export async function fetchOrgCloudStorageConfigured(
  orgId: string
): Promise<OrgCloudStorageConfiguredStatus> {
  return makeRequest<OrgCloudStorageConfiguredStatus>(
    `${platformAiEndpoint(orgId)}/storage-status?scope=configured`
  );
}

export async function fetchOrgCloudStorageHealth(
  orgId: string,
  options?: { readonly force?: boolean; readonly origin?: string }
): Promise<OrgCloudStorageStatus> {
  const params = new URLSearchParams({ scope: "health" });
  if (options?.force) {
    params.set("force", "true");
  }
  if (options?.origin) {
    params.set("origin", options.origin);
  }
  return makeRequest<OrgCloudStorageStatus>(
    `${platformAiEndpoint(orgId)}/storage-status?${params.toString()}`
  );
}

export async function ensureDirectUploadCorsForOrg(
  orgId: string,
  origin: string
): Promise<{
  readonly applied: boolean;
  readonly throttled?: boolean;
  readonly blocksGenerativeMedia: boolean;
}> {
  return makeRequest(
    `${platformAiEndpoint(orgId)}/ensure-direct-upload-cors`,
    {
      method: "POST",
      body: JSON.stringify({ origin }),
    }
  );
}

/** One-shot configured check for non-canvas views (e.g. workflow library). */
export function useOrgCloudStorageConfigured(orgId: string | undefined) {
  const key = orgId
    ? `${platformAiEndpoint(orgId)}/storage-status?scope=configured`
    : null;
  const { data, isLoading } = useSWR(
    key,
    async () => fetchOrgCloudStorageConfigured(orgId!),
    {
      revalidateOnFocus: false,
      refreshInterval: 0,
    }
  );

  return {
    configured: data?.configured ?? false,
    isLoading,
  };
}

/** @deprecated Use useCloudStorageCanvasContext inside the workflow editor. */
export function useOrgCloudStorageStatus(orgId: string | undefined) {
  const key = orgId ? `${platformAiEndpoint(orgId)}/storage-status?scope=health` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    async () => fetchOrgCloudStorageHealth(orgId!),
    { revalidateOnFocus: false, refreshInterval: 0 }
  );

  return {
    configured: data?.configured ?? false,
    blocksGenerativeMedia: data?.blocksGenerativeMedia ?? false,
    health: data?.health ?? null,
    statusError: error,
    isLoading,
    refreshStatus: mutate,
  };
}

export async function generateAiImage(
  orgId: string,
  body: GenerateAiImageRequest
): Promise<GenerateAiImageResponse> {
  return makeRequest<GenerateAiImageResponse>(
    `${platformAiEndpoint(orgId)}/ai-image/generate`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function submitAiVideo(
  orgId: string,
  body: SubmitAiVideoRequest
): Promise<SubmitAiVideoResponse> {
  return makeRequest<SubmitAiVideoResponse>(
    `${platformAiEndpoint(orgId)}/ai-video/submit`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function pollAiVideoTask(
  orgId: string,
  taskId: string,
  aiInterfaceId: string,
  options?: { readonly workflowId?: string; readonly modelCanonicalId?: string }
): Promise<PollAiVideoTaskResponse> {
  const query = new URLSearchParams({ aiInterfaceId });
  if (options?.workflowId) {
    query.set("workflowId", options.workflowId);
  }
  if (options?.modelCanonicalId) {
    query.set("modelCanonicalId", options.modelCanonicalId);
  }
  return makeRequest<PollAiVideoTaskResponse>(
    `${platformAiEndpoint(orgId)}/ai-video/tasks/${encodeURIComponent(taskId)}?${query.toString()}`
  );
}

export async function generateAiAudio(
  orgId: string,
  body: GenerateAiAudioRequest
): Promise<GenerateAiAudioResponse> {
  return makeRequest<GenerateAiAudioResponse>(
    `${platformAiEndpoint(orgId)}/ai-audio/generate`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function getGenerationJob(
  orgId: string,
  jobId: string
): Promise<GetGenerationJobResponse> {
  return makeRequest<GetGenerationJobResponse>(
    `${platformAiEndpoint(orgId)}/generation-jobs/${encodeURIComponent(jobId)}`
  );
}

export async function completeGenerationJobUpload(
  orgId: string,
  jobId: string,
  finalMedia: CompleteGenerationJobUploadRequest["finalMedia"]
): Promise<CompleteGenerationJobUploadResponse> {
  return makeRequest<CompleteGenerationJobUploadResponse>(
    `${platformAiEndpoint(orgId)}/generation-jobs/${encodeURIComponent(jobId)}/complete-upload`,
    {
      method: "POST",
      body: JSON.stringify({ finalMedia } satisfies CompleteGenerationJobUploadRequest),
    }
  );
}

export async function claimGenerationJobClientUpload(
  orgId: string,
  jobId: string
): Promise<GetGenerationJobResponse> {
  return makeRequest<GetGenerationJobResponse>(
    `${platformAiEndpoint(orgId)}/generation-jobs/${encodeURIComponent(jobId)}/claim-client-upload`,
    { method: "POST" }
  );
}

export async function requestGenerationJobServerPersist(
  orgId: string,
  jobId: string
): Promise<GetGenerationJobResponse> {
  return makeRequest<GetGenerationJobResponse>(
    `${platformAiEndpoint(orgId)}/generation-jobs/${encodeURIComponent(jobId)}/request-server-persist`,
    { method: "POST" }
  );
}

export async function resolveOrgTextModel(
  orgId: string,
  canonicalId: string,
  interfaceId: string
): Promise<{ aiInterfaceId: string; providerModelId: string }> {
  const query = new URLSearchParams({ aiInterfaceId: interfaceId });
  return makeRequest<{ aiInterfaceId: string; providerModelId: string }>(
    `${platformAiEndpoint(orgId)}/text-models/${encodeURIComponent(canonicalId)}/resolve?${query.toString()}`
  );
}

export async function generateAiText(
  orgId: string,
  body: GenerateAiTextRequest
): Promise<GenerateAiTextResponse> {
  return makeRequest<GenerateAiTextResponse>(
    `${platformAiEndpoint(orgId)}/ai-text/generate`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export interface GenerateAiTextStreamHandlers {
  readonly onDelta?: (delta: string, fullText: string) => void;
  readonly signal?: AbortSignal;
}

/**
 * Browser → Dafthunk SSE proxy → upstream chat stream.
 * Server finalizes the invocation once; client must only persist node state on `done`.
 */
export async function generateAiTextStream(
  orgId: string,
  body: GenerateAiTextRequest,
  handlers: GenerateAiTextStreamHandlers = {}
): Promise<GenerateAiTextResponse> {
  const { buildApiUrl } = await import("@/config/api");
  const fullUrl = buildApiUrl(
    `${platformAiEndpoint(orgId)}/ai-text/generate-stream`
  );

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
    signal: handlers.signal,
  });

  if (!response.ok) {
    let message = `Request failed with status: ${response.status}`;
    try {
      const errorData = (await response.json()) as { error?: string };
      if (errorData.error) {
        message = errorData.error;
      }
    } catch {
      // keep status message
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("No stream body from server");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let donePayload: GenerateAiTextResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (!data) {
          continue;
        }

        let event: {
          type?: string;
          text?: string;
          error?: string;
          invocationId?: string;
          aiInterfaceId?: string;
        };
        try {
          event = JSON.parse(data) as typeof event;
        } catch {
          continue;
        }

        if (event.type === "delta" && typeof event.text === "string") {
          fullText += event.text;
          handlers.onDelta?.(event.text, fullText);
          continue;
        }

        if (event.type === "done" && typeof event.text === "string") {
          fullText = event.text;
          if (
            typeof event.invocationId === "string" &&
            typeof event.aiInterfaceId === "string"
          ) {
            donePayload = {
              text: event.text,
              invocationId: event.invocationId,
              aiInterfaceId: event.aiInterfaceId,
            };
          }
          continue;
        }

        if (event.type === "error") {
          throw new Error(event.error || "Generation failed");
        }
      }
    }
  }

  if (!donePayload) {
    throw new Error(
      fullText.trim()
        ? "Stream ended without completion event"
        : "Stream returned no text"
    );
  }

  return donePayload;
}

export function useModelCalls(
  orgId: string | undefined,
  options?: { limit?: number; offset?: number }
) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const key = orgId
    ? `${platformAiEndpoint(orgId)}/model-calls?limit=${limit}&offset=${offset}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(key, async () =>
    makeRequest<ListAiModelInvocationsResponse>(`${key}`),
    {
      refreshInterval: (latest) =>
        latest?.invocations.some((entry) => entry.status === "pending")
          ? 3000
          : 0,
    }
  );

  return {
    invocations: data?.invocations ?? [],
    total: data?.total ?? 0,
    invocationsError: error,
    isLoading,
    refreshInvocations: mutate,
  };
}

export async function fetchModelCallDetail(
  orgId: string,
  id: string
): Promise<ListAiModelInvocationsResponse["invocations"][number]> {
  const response = await makeRequest<{
    invocation: ListAiModelInvocationsResponse["invocations"][number];
  }>(`${platformAiEndpoint(orgId)}/model-calls/${id}`);
  return response.invocation;
}
