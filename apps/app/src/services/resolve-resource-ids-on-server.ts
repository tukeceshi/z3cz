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
}): Promise<ResolveResourceRefsResponse> {
  if (params.resourceIds.length === 0) {
    return { resolved: [], unresolved: [] };
  }

  return makeRequest<ResolveResourceRefsResponse>(
    `${platformAiEndpoint(params.organizationId)}/resolve-resource-refs`,
    {
      method: "POST",
      body: JSON.stringify({ resourceIds: params.resourceIds }),
    }
  );
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
