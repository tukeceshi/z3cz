import type {
  BootstrapPersistWorkerRequest,
  BootstrapPersistWorkerResponse,
  ListPersistWorkersResponse,
  PersistWorker,
  PersistWorkerPoolSettings,
  RedeployPersistWorkerRequest,
  RedeployPersistWorkerResponse,
  UpdatePersistWorkerRequest,
  UpdatePersistWorkerResponse,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

const ADMIN_ENDPOINT = "/admin/persist-workers";

export function useAdminPersistWorkers() {
  const { data, error, isLoading, mutate } = useSWR(ADMIN_ENDPOINT, async () => {
    return makeRequest<ListPersistWorkersResponse>(ADMIN_ENDPOINT);
  });

  return {
    workers: data?.workers ?? [],
    settings: data?.settings ?? { enabled: false },
    workersError: error,
    isWorkersLoading: isLoading,
    refreshWorkers: mutate,
  };
}

export async function updateAdminPersistWorkerPoolSettings(
  enabled: boolean
): Promise<PersistWorkerPoolSettings> {
  const response = await makeRequest<{ settings: PersistWorkerPoolSettings }>(
    `${ADMIN_ENDPOINT}/settings`,
    {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }
  );
  return response.settings;
}

export async function bootstrapAdminPersistWorker(
  input: BootstrapPersistWorkerRequest
): Promise<BootstrapPersistWorkerResponse> {
  return makeRequest(`${ADMIN_ENDPOINT}/bootstrap`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function redeployAdminPersistWorker(
  id: string,
  input: RedeployPersistWorkerRequest
): Promise<RedeployPersistWorkerResponse> {
  return makeRequest(`${ADMIN_ENDPOINT}/${id}/redeploy`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAdminPersistWorker(
  id: string,
  input: UpdatePersistWorkerRequest
): Promise<UpdatePersistWorkerResponse> {
  return makeRequest(`${ADMIN_ENDPOINT}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAdminPersistWorker(id: string): Promise<void> {
  await makeRequest(`${ADMIN_ENDPOINT}/${id}`, {
    method: "DELETE",
  });
}

export type { PersistWorker, PersistWorkerPoolSettings };
