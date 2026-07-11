import type {
  CreateWorkflowSchemeRequest,
  ListPublicWorkflowSchemesResponse,
  ListWorkflowSchemesResponse,
  PublicWorkflowScheme,
  UpdateWorkflowSchemeRequest,
  WorkflowScheme,
} from "@dafthunk/types";
import useSWR from "swr";

import { makeRequest } from "./utils";

const PUBLIC_ENDPOINT = "/workflow-schemes";
const ADMIN_ENDPOINT = "/admin/workflow-schemes";

export function usePublicWorkflowSchemes() {
  const { data, error, isLoading, mutate } = useSWR(PUBLIC_ENDPOINT, async () => {
    const response = await makeRequest<ListPublicWorkflowSchemesResponse>(
      PUBLIC_ENDPOINT
    );
    return response.schemes;
  });

  return {
    schemes: data ?? [],
    schemesError: error,
    isSchemesLoading: isLoading,
    refreshSchemes: mutate,
  };
}

export function useAdminWorkflowSchemes() {
  const { data, error, isLoading, mutate } = useSWR(ADMIN_ENDPOINT, async () => {
    const response = await makeRequest<ListWorkflowSchemesResponse>(
      ADMIN_ENDPOINT
    );
    return response.schemes;
  });

  return {
    schemes: data ?? [],
    schemesError: error,
    isSchemesLoading: isLoading,
    refreshSchemes: mutate,
  };
}

export async function createAdminWorkflowScheme(
  input: CreateWorkflowSchemeRequest
): Promise<WorkflowScheme> {
  const response = await makeRequest<{ scheme: WorkflowScheme }>(
    ADMIN_ENDPOINT,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return response.scheme;
}

export async function updateAdminWorkflowScheme(
  id: string,
  input: UpdateWorkflowSchemeRequest
): Promise<WorkflowScheme> {
  const response = await makeRequest<{ scheme: WorkflowScheme }>(
    `${ADMIN_ENDPOINT}/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return response.scheme;
}

export async function deleteAdminWorkflowScheme(id: string): Promise<void> {
  await makeRequest(`${ADMIN_ENDPOINT}/${id}`, {
    method: "DELETE",
  });
}

export type { PublicWorkflowScheme, WorkflowScheme };
