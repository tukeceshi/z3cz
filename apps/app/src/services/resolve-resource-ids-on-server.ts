import { isPublicCharacterLibraryResourceId } from "@dafthunk/types";

import { makeRequest } from "@/services/utils";

interface ResolveResourceRefsResponse {
  readonly resolved: readonly {
    readonly resourceId: string;
    readonly url: string;
    readonly mimeType: string;
  }[];
  readonly unresolved: readonly string[];
}

function platformAiEndpoint(organizationId: string): string {
  return `/${organizationId}/platform-ai`;
}

export async function resolveResourceIdsOnServer(params: {
  readonly organizationId: string;
  readonly resourceIds: readonly string[];
  readonly generationSubmit?: boolean;
}): Promise<ResolveResourceRefsResponse> {
  const catalogIds = params.resourceIds.filter(
    (id) => !isPublicCharacterLibraryResourceId(id)
  );
  const skipped = params.resourceIds.filter((id) =>
    isPublicCharacterLibraryResourceId(id)
  );
  if (catalogIds.length === 0) {
    return { resolved: [], unresolved: skipped };
  }

  const response = await makeRequest<ResolveResourceRefsResponse>(
    `${platformAiEndpoint(params.organizationId)}/resolve-resource-refs`,
    {
      method: "POST",
      body: JSON.stringify({
        resourceIds: catalogIds,
        ...(params.generationSubmit ? { generationSubmit: true } : {}),
      }),
    }
  );
  return skipped.length === 0
    ? response
    : {
        resolved: response.resolved,
        unresolved: [...response.unresolved, ...skipped],
      };
}

export async function isResourceIdCloudResolvable(params: {
  readonly organizationId: string;
  readonly resourceId: string;
}): Promise<boolean> {
  const response = await resolveResourceIdsOnServer({
    organizationId: params.organizationId,
    resourceIds: [params.resourceId],
  });
  return response.resolved.some(
    (entry) => entry.resourceId === params.resourceId && entry.url.length > 0
  );
}
