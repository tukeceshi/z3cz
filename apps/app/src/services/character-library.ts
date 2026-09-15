import type {
  AddCharacterLibraryCharacterItemRequest,
  AddCharacterLibraryRequest,
  CharacterLibraryCharacter,
  CharacterLibraryEntry,
  CharacterLibraryStatusResponse,
  CreateCharacterLibraryCharacterRequest,
  ListCharacterLibraryResponse,
  ListPublicCharacterLibraryResponse,
} from "@dafthunk/types";

import { makeRequest } from "@/services/utils";

export async function listCharacterLibraryEntries(params: {
  readonly organizationId: string;
  readonly interfaceId?: string;
}): Promise<{
  readonly entries: readonly CharacterLibraryEntry[];
  readonly characters: readonly CharacterLibraryCharacter[];
  readonly groupId: string | null;
}> {
  const query = params.interfaceId
    ? `?interfaceId=${encodeURIComponent(params.interfaceId)}`
    : "";
  const response = await makeRequest<ListCharacterLibraryResponse>(
    `/${params.organizationId}/character-library${query}`
  );
  return {
    entries: response.entries,
    characters: response.characters ?? [],
    groupId: response.groupId ?? null,
  };
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

export async function listPublicCharacterLibraryGroups(params: {
  readonly organizationId: string;
  readonly interfaceId?: string;
  readonly query?: string;
  readonly gender?: string;
  readonly country?: string;
  readonly ageMin?: number;
  readonly ageMax?: number;
  readonly page?: number;
}): Promise<ListPublicCharacterLibraryResponse> {
  const search = new URLSearchParams();
  if (params.interfaceId) {
    search.set("interfaceId", params.interfaceId);
  }
  if (params.query) {
    search.set("q", params.query);
  }
  if (params.gender && params.gender !== "all") {
    search.set("gender", params.gender);
  }
  if (params.country && params.country !== "all") {
    search.set("country", params.country);
  }
  if (params.ageMin !== undefined) {
    search.set("ageMin", String(params.ageMin));
  }
  if (params.ageMax !== undefined) {
    search.set("ageMax", String(params.ageMax));
  }
  if (params.page !== undefined) {
    search.set("page", String(params.page));
  }
  const query = search.toString();
  return makeRequest<ListPublicCharacterLibraryResponse>(
    `/${params.organizationId}/character-library/public${
      query ? `?${query}` : ""
    }`
  );
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
        ...(params.modelCanonicalId
          ? { modelCanonicalId: params.modelCanonicalId }
          : {}),
        ...(params.interfaceId ? { interfaceId: params.interfaceId } : {}),
        ...(params.workflowId ? { workflowId: params.workflowId } : {}),
        ...(params.category ? { category: params.category } : {}),
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

export async function createCharacterLibraryCharacter(
  params: CreateCharacterLibraryCharacterRequest & {
    readonly organizationId: string;
  }
): Promise<CharacterLibraryCharacter> {
  const response = await makeRequest<{ character: CharacterLibraryCharacter }>(
    `/${params.organizationId}/character-library/characters`,
    {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        ...(params.workflowId ? { workflowId: params.workflowId } : {}),
      }),
    }
  );
  return response.character;
}

export async function deleteCharacterLibraryCharacter(params: {
  readonly organizationId: string;
  readonly characterId: string;
}): Promise<void> {
  await makeRequest(
    `/${params.organizationId}/character-library/characters/${encodeURIComponent(
      params.characterId
    )}`,
    { method: "DELETE" }
  );
}

export async function addCharacterLibraryCharacterItem(
  params: AddCharacterLibraryCharacterItemRequest & {
    readonly organizationId: string;
    readonly characterId: string;
  }
): Promise<CharacterLibraryCharacter> {
  const response = await makeRequest<{ character: CharacterLibraryCharacter }>(
    `/${params.organizationId}/character-library/characters/${encodeURIComponent(
      params.characterId
    )}/items`,
    {
      method: "POST",
      body: JSON.stringify({ resourceId: params.resourceId }),
    }
  );
  return response.character;
}

export async function removeCharacterLibraryCharacterItem(params: {
  readonly organizationId: string;
  readonly characterId: string;
  readonly resourceId: string;
}): Promise<void> {
  await makeRequest(
    `/${params.organizationId}/character-library/characters/${encodeURIComponent(
      params.characterId
    )}/items/${encodeURIComponent(params.resourceId)}`,
    { method: "DELETE" }
  );
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
