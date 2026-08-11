import type {
  AiModelInvocationDetailResponse,
  ListPlatformAiModelsResponse,
  ListAiModelInvocationsResponse,
  PlatformAiModel,
  UpdatePlatformAiModelRequest,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

const ADMIN_MODELS_BASE = "/admin/ai-models";

export function useAdminPlatformAiModels(modality?: string) {
  const query = modality ? `?modality=${modality}` : "";
  const key = `${ADMIN_MODELS_BASE}${query}`;
  const { data, error, isLoading, mutate } = useSWR(key, async () =>
    makeRequest<ListPlatformAiModelsResponse>(key)
  );

  return {
    models: data?.models ?? [],
    modelsError: error,
    isLoading,
    refreshModels: mutate,
  };
}

export async function updateAdminPlatformAiModel(
  canonicalId: string,
  body: UpdatePlatformAiModelRequest
): Promise<PlatformAiModel> {
  const response = await makeRequest<{ model: PlatformAiModel }>(
    `${ADMIN_MODELS_BASE}/${canonicalId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
  return response.model;
}

export async function reorderAdminPlatformAiModels(
  orderedCanonicalIds: readonly string[],
  modality?: string
): Promise<readonly PlatformAiModel[]> {
  const query = modality ? `?modality=${modality}` : "";
  const response = await makeRequest<{ models: readonly PlatformAiModel[] }>(
    `${ADMIN_MODELS_BASE}/reorder${query}`,
    {
      method: "PUT",
      body: JSON.stringify({ orderedCanonicalIds }),
    }
  );
  return response.models;
}

export function useAdminModelInvocations(options?: {
  limit?: number;
  offset?: number;
}) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const key = `/admin/model-invocations?limit=${limit}&offset=${offset}`;
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

export async function fetchAdminModelCallDetail(
  id: string
): Promise<AiModelInvocationDetailResponse> {
  return makeRequest<AiModelInvocationDetailResponse>(
    `/admin/model-invocations/${id}`
  );
}
