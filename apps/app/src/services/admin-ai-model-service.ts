import type {
  CreatePlatformAiModelGroupRequest,
  ListPlatformAiModelGroupsResponse,
  ListPlatformAiModelsResponse,
  ListAiModelInvocationsResponse,
  PlatformAiModel,
  PlatformAiModelGroup,
  UpdatePlatformAiModelGroupRequest,
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
    groups: data?.groups ?? [],
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
  orderedCanonicalIds: readonly string[]
): Promise<readonly PlatformAiModel[]> {
  const response = await makeRequest<{ models: readonly PlatformAiModel[] }>(
    `${ADMIN_MODELS_BASE}/reorder`,
    {
      method: "PUT",
      body: JSON.stringify({ orderedCanonicalIds }),
    }
  );
  return response.models;
}

export async function createAdminPlatformAiModelGroup(
  body: CreatePlatformAiModelGroupRequest
): Promise<PlatformAiModelGroup> {
  const response = await makeRequest<{ group: PlatformAiModelGroup }>(
    `${ADMIN_MODELS_BASE}/groups`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  return response.group;
}

export async function updateAdminPlatformAiModelGroup(
  groupId: string,
  body: UpdatePlatformAiModelGroupRequest
): Promise<PlatformAiModelGroup> {
  const response = await makeRequest<{ group: PlatformAiModelGroup }>(
    `${ADMIN_MODELS_BASE}/groups/${encodeURIComponent(groupId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
  return response.group;
}

export async function deleteAdminPlatformAiModelGroup(
  groupId: string
): Promise<void> {
  await makeRequest(`${ADMIN_MODELS_BASE}/groups/${encodeURIComponent(groupId)}`, {
    method: "DELETE",
  });
}

export function useAdminPlatformAiModelGroups() {
  const key = `${ADMIN_MODELS_BASE}/groups`;
  const { data, error, isLoading, mutate } = useSWR(key, async () =>
    makeRequest<ListPlatformAiModelGroupsResponse>(key)
  );

  return {
    groups: data?.groups ?? [],
    groupsError: error,
    isLoading,
    refreshGroups: mutate,
  };
}

export function useAdminModelInvocations(options?: {
  limit?: number;
  offset?: number;
}) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const key = `/admin/model-invocations?limit=${limit}&offset=${offset}`;
  const { data, error, isLoading, mutate } = useSWR(key, async () =>
    makeRequest<ListAiModelInvocationsResponse>(key),
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
): Promise<ListAiModelInvocationsResponse["invocations"][number]> {
  const response = await makeRequest<{
    invocation: ListAiModelInvocationsResponse["invocations"][number];
  }>(`/admin/model-invocations/${id}`);
  return response.invocation;
}
