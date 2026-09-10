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

function orgWorkersEndpoint(organizationId: string): string {
  return `/${organizationId}/cloud-acceleration/workers`;
}

export function useOrgPersistWorkers(organizationId: string | undefined) {
  const key = organizationId ? orgWorkersEndpoint(organizationId) : null;
  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    return makeRequest<ListPersistWorkersResponse>(
      orgWorkersEndpoint(organizationId!)
    );
  });

  return {
    workers: data?.workers ?? [],
    settings: data?.settings ?? { enabled: false },
    workersError: error,
    isWorkersLoading: isLoading,
    refreshWorkers: mutate,
  };
}

export async function updateOrgPersistWorkerPoolSettings(
  organizationId: string,
  enabled: boolean
): Promise<PersistWorkerPoolSettings> {
  const response = await makeRequest<{ settings: PersistWorkerPoolSettings }>(
    `${orgWorkersEndpoint(organizationId)}/settings`,
    {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }
  );
  return response.settings;
}

export async function bootstrapOrgPersistWorker(
  organizationId: string,
  input: BootstrapPersistWorkerRequest
): Promise<BootstrapPersistWorkerResponse> {
  return makeRequest(`${orgWorkersEndpoint(organizationId)}/bootstrap`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function redeployOrgPersistWorker(
  organizationId: string,
  id: string,
  input: RedeployPersistWorkerRequest
): Promise<RedeployPersistWorkerResponse> {
  return makeRequest(
    `${orgWorkersEndpoint(organizationId)}/${id}/redeploy`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function deleteOrgPersistWorker(
  organizationId: string,
  id: string
): Promise<void> {
  await makeRequest(`${orgWorkersEndpoint(organizationId)}/${id}`, {
    method: "DELETE",
  });
}

export type { PersistWorker, PersistWorkerPoolSettings };
