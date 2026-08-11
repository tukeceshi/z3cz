import type { ResolvedMediaResourceEntry } from "@dafthunk/types";
import {
  getResourceIdFromValue,
  isResourceIdReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";

import { buildMediaProxyEndpoint } from "@/services/media-cache-fetch-utils";
import { makeRequest } from "@/services/utils";

interface ResolveMediaResourcesResponse {
  readonly resolved: readonly ResolvedMediaResourceEntry[];
  readonly unresolved: readonly string[];
}

const resolveCache = new Map<string, Promise<ResolvedMediaResourceEntry | null>>();

function resourcesEndpoint(organizationId: string): string {
  return `/${organizationId}/resources/resolve`;
}

function resolveCacheKey(organizationId: string, resourceId: string): string {
  return `${organizationId}:${resourceId}`;
}

export function buildFetchUrlFromResolvedEntry(
  entry: ResolvedMediaResourceEntry,
  organizationId: string
): string | null {
  if (entry.kind === "cloud" && entry.url) {
    return entry.url;
  }

  if (entry.kind === "ephemeral" && entry.upstreamUrl) {
    if (entry.expiresAt && Date.parse(entry.expiresAt) <= Date.now()) {
      return null;
    }
    return buildMediaProxyEndpoint(
      organizationId,
      entry.upstreamUrl,
      entry.mimeType
    );
  }

  return null;
}

export async function resolveMediaResourceEntry(params: {
  readonly organizationId: string;
  readonly resourceId: string;
}): Promise<ResolvedMediaResourceEntry | null> {
  const resourceId = params.resourceId.trim();
  if (!resourceId) {
    return null;
  }

  const cacheKey = resolveCacheKey(params.organizationId, resourceId);
  const existing = resolveCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = makeRequest<ResolveMediaResourcesResponse>(
    resourcesEndpoint(params.organizationId),
    {
      method: "POST",
      body: JSON.stringify({ resourceIds: [resourceId] }),
    }
  )
    .then((response) => {
      const entry = response.resolved.find(
        (item) => item.resourceId === resourceId
      );
      return entry ?? null;
    })
    .catch(() => null)
    .finally(() => {
      resolveCache.delete(cacheKey);
    });

  resolveCache.set(cacheKey, promise);
  return promise;
}

export async function resolveMediaResourceFetchUrl(params: {
  readonly organizationId: string;
  readonly media: WorkflowMediaValue;
}): Promise<string | null> {
  if (!isResourceIdReference(params.media)) {
    return null;
  }

  const resourceId = getResourceIdFromValue(params.media);
  if (!resourceId) {
    return null;
  }

  const entry = await resolveMediaResourceEntry({
    organizationId: params.organizationId,
    resourceId,
  });
  if (!entry) {
    return null;
  }
  return buildFetchUrlFromResolvedEntry(entry, params.organizationId);
}

export async function resolveMediaResourceFetchUrls(params: {
  readonly organizationId: string;
  readonly resourceIds: readonly string[];
}): Promise<ReadonlyMap<string, string>> {
  const uniqueIds = [
    ...new Set(
      params.resourceIds.map((id) => id.trim()).filter((id) => id.length > 0)
    ),
  ];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const response = await makeRequest<ResolveMediaResourcesResponse>(
    resourcesEndpoint(params.organizationId),
    {
      method: "POST",
      body: JSON.stringify({ resourceIds: uniqueIds }),
    }
  ).catch(() => ({ resolved: [], unresolved: uniqueIds }));

  const urls = new Map<string, string>();
  for (const entry of response.resolved) {
    const fetchUrl = buildFetchUrlFromResolvedEntry(
      entry,
      params.organizationId
    );
    if (fetchUrl) {
      urls.set(entry.resourceId, fetchUrl);
    }
  }
  return urls;
}

export function workflowMediaMimeType(
  media: WorkflowMediaValue,
  resolved?: ResolvedMediaResourceEntry | null
): string {
  return resolved?.mimeType ?? media.mimeType ?? "application/octet-stream";
}
