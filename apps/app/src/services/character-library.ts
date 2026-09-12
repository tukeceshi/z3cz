import type {
  AddCharacterLibraryRequest,
  CharacterLibraryEntry,
  CharacterLibraryStatusResponse,
  ListCharacterLibraryResponse,
} from "@dafthunk/types";

import { makeRequest } from "@/services/utils";

export async function listCharacterLibraryEntries(params: {
  readonly organizationId: string;
  readonly interfaceId?: string;
}): Promise<readonly CharacterLibraryEntry[]> {
  const query = params.interfaceId
    ? `?interfaceId=${encodeURIComponent(params.interfaceId)}`
    : "";
  const response = await makeRequest<ListCharacterLibraryResponse>(
    `/${params.organizationId}/character-library${query}`
  );
  return response.entries;
}

export async function fetchCharacterLibraryStatus(params: {
  readonly organizationId: string;
  readonly interfaceId: string;
}): Promise<boolean> {
  const response = await makeRequest<CharacterLibraryStatusResponse>(
    `/${params.organizationId}/character-library/status?interfaceId=${encodeURIComponent(
      params.interfaceId
    )}`
  );
  return response.enabled;
}

export async function addCharacterLibraryEntry(
  params: AddCharacterLibraryRequest & { readonly organizationId: string }
): Promise<CharacterLibraryEntry> {
  const response = await makeRequest<{ entry: CharacterLibraryEntry }>(
    `/${params.organizationId}/character-library`,
    {
      method: "POST",
      body: JSON.stringify({
        resourceId: params.resourceId,
        ...(params.modelCanonicalId ? { modelCanonicalId: params.modelCanonicalId } : {}),
        ...(params.interfaceId ? { interfaceId: params.interfaceId } : {}),
      }),
    }
  );
  return response.entry;
}

export async function importCharacterLibraryEntry(params: {
  readonly organizationId: string;
  readonly resourceId: string;
}): Promise<CharacterLibraryEntry> {
  const response = await makeRequest<{ entry: CharacterLibraryEntry }>(
    `/${params.organizationId}/character-library/${encodeURIComponent(
      params.resourceId
    )}/import`,
    { method: "POST" }
  );
  return response.entry;
}

export async function fetchCharacterLibraryImportStatus(params: {
  readonly organizationId: string;
  readonly resourceId: string;
}): Promise<"pending" | "active" | "failed"> {
  const response = await makeRequest<{
    status: "pending" | "active" | "failed";
  }>(
    `/${params.organizationId}/character-library/${encodeURIComponent(
      params.resourceId
    )}/import-status`
  );
  return response.status;
}

export async function removeCharacterLibraryEntry(params: {
  readonly organizationId: string;
  readonly resourceId: string;
}): Promise<void> {
  await makeRequest(
    `/${params.organizationId}/character-library/${encodeURIComponent(
      params.resourceId
    )}`,
    { method: "DELETE" }
  );
}
