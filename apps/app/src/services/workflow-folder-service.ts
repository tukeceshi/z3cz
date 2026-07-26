import type {
  CreateWorkflowFolderRequest,
  CreateWorkflowFolderResponse,
  DeleteWorkflowFolderResponse,
  ListWorkflowFoldersResponse,
  UpdateWorkflowFolderRequest,
  UpdateWorkflowFolderResponse,
  WorkflowFolder,
} from "@dafthunk/types";
import useSWR from "swr";

import { useAuth } from "@/components/auth-context";

import { makeOrgRequest } from "./utils";

const API_ENDPOINT_BASE = "/workflow-folders";

export function useWorkflowFolders(): {
  folders: WorkflowFolder[];
  foldersError: Error | null;
  isFoldersLoading: boolean;
  mutateFolders: () => Promise<WorkflowFolder[] | undefined>;
} {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const swrKey = orgId ? `/${orgId}${API_ENDPOINT_BASE}` : null;

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    swrKey && orgId
      ? async () => {
          const response = await makeOrgRequest<ListWorkflowFoldersResponse>(
            orgId,
            API_ENDPOINT_BASE,
            ""
          );
          return response.folders;
        }
      : null
  );

  return {
    folders: data ?? [],
    foldersError: error ?? null,
    isFoldersLoading: isLoading,
    mutateFolders: mutate,
  };
}

export async function createWorkflowFolder(
  request: CreateWorkflowFolderRequest,
  orgId: string
): Promise<WorkflowFolder> {
  return makeOrgRequest<CreateWorkflowFolderResponse>(
    orgId,
    API_ENDPOINT_BASE,
    "",
    {
      method: "POST",
      body: JSON.stringify(request),
    }
  );
}

export async function updateWorkflowFolder(
  folderId: string,
  request: UpdateWorkflowFolderRequest,
  orgId: string
): Promise<WorkflowFolder> {
  return makeOrgRequest<UpdateWorkflowFolderResponse>(
    orgId,
    API_ENDPOINT_BASE,
    `/${folderId}`,
    {
      method: "PATCH",
      body: JSON.stringify(request),
    }
  );
}

export async function deleteWorkflowFolder(
  folderId: string,
  orgId: string
): Promise<DeleteWorkflowFolderResponse> {
  return makeOrgRequest<DeleteWorkflowFolderResponse>(
    orgId,
    API_ENDPOINT_BASE,
    `/${folderId}`,
    { method: "DELETE" }
  );
}

export async function getWorkflowFolder(
  folderId: string,
  orgId: string
): Promise<WorkflowFolder> {
  return makeOrgRequest<WorkflowFolder>(
    orgId,
    API_ENDPOINT_BASE,
    `/${folderId}`,
    { method: "GET" }
  );
}

export function useWorkflowFolder(folderId: string | undefined): {
  folder: WorkflowFolder | undefined;
  folderError: Error | null;
  isFolderLoading: boolean;
  mutateFolder: () => Promise<WorkflowFolder | undefined>;
} {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const swrKey =
    orgId && folderId ? `/${orgId}${API_ENDPOINT_BASE}/${folderId}` : null;

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    swrKey && orgId && folderId
      ? () => getWorkflowFolder(folderId, orgId)
      : null
  );

  return {
    folder: data,
    folderError: error ?? null,
    isFolderLoading: isLoading,
    mutateFolder: mutate,
  };
}
