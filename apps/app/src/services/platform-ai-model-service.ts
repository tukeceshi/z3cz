import type {
  GenerateAiImageRequest,
  GenerateAiImageResponse,
  GenerateAiTextRequest,
  GenerateAiTextResponse,
  ListAiModelInvocationsResponse,
  ListModelInterfacePrioritiesResponse,
  ListOrgImageModelsResponse,
  ListOrgTextModelsResponse,
  OrgCloudStorageStatus,
  UpdateModelInterfacePriorityRequest,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

function platformAiEndpoint(organizationId: string): string {
  return `/${organizationId}/platform-ai`;
}

export function useOrgTextModels(orgId: string | undefined) {
  const key = orgId ? `${platformAiEndpoint(orgId)}/text-models` : null;
  const { data, error, isLoading, mutate } = useSWR(key, async () =>
    makeRequest<ListOrgTextModelsResponse>(`${key}`)
  );

  return {
    models: data?.models ?? [],
    groups: data?.groups ?? [],
    modelsError: error,
    isLoading,
    refreshModels: mutate,
  };
}

export function useOrgImageModels(orgId: string | undefined) {
  const key = orgId ? `${platformAiEndpoint(orgId)}/image-models` : null;
  const { data, error, isLoading, mutate } = useSWR(key, async () =>
    makeRequest<ListOrgImageModelsResponse>(`${key}`)
  );

  return {
    models: data?.models ?? [],
    groups: data?.groups ?? [],
    modelsError: error,
    isLoading,
    refreshModels: mutate,
  };
}

export async function resolveOrgImageModel(
  orgId: string,
  canonicalId: string
): Promise<{ aiInterfaceId: string; providerModelId: string }> {
  return makeRequest<{ aiInterfaceId: string; providerModelId: string }>(
    `${platformAiEndpoint(orgId)}/image-models/${encodeURIComponent(canonicalId)}/resolve`
  );
}

export function useOrgCloudStorageStatus(orgId: string | undefined) {
  const key = orgId ? `${platformAiEndpoint(orgId)}/storage-status` : null;
  const { data, error, isLoading, mutate } = useSWR(key, async () =>
    makeRequest<OrgCloudStorageStatus>(`${key}`)
  );

  return {
    configured: data?.configured ?? false,
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

export async function resolveOrgTextModel(
  orgId: string,
  canonicalId: string
): Promise<{ aiInterfaceId: string; providerModelId: string }> {
  return makeRequest<{ aiInterfaceId: string; providerModelId: string }>(
    `${platformAiEndpoint(orgId)}/text-models/${encodeURIComponent(canonicalId)}/resolve`
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

export function useModelInterfacePriorities(orgId: string | undefined) {
  const key = orgId
    ? `${platformAiEndpoint(orgId)}/model-interface-priorities`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, async () =>
    makeRequest<ListModelInterfacePrioritiesResponse>(`${key}`)
  );

  return {
    priorities: data?.priorities ?? [],
    prioritiesError: error,
    isLoading,
    refreshPriorities: mutate,
  };
}

export async function updateModelInterfacePriority(
  orgId: string,
  body: UpdateModelInterfacePriorityRequest
): Promise<void> {
  await makeRequest(`${platformAiEndpoint(orgId)}/model-interface-priorities`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
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
    makeRequest<ListAiModelInvocationsResponse>(`${key}`)
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
