import type { ObjectReference } from "@dafthunk/types";
import { isCloudObjectReference } from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { getMediaResourcesByIds } from "../db/media-resource-queries";
import { resolveMediaResources } from "./media-resource-catalog-service";
import { presignTosMediaDownloadUrls } from "./tos-media-presign";

const VIDEO_URL_PATTERN = /^https?:\/\//i;

function assertPublicVideoUrl(url: string): string {
  const trimmed = url
    .trim()
    .replace(/\\u0026/gi, "&")
    .replace(/\\&/g, "&")
    .replace(/\\+$/, "");
  if (!VIDEO_URL_PATTERN.test(trimmed)) {
    throw new Error("Video URL must start with http:// or https://");
  }
  return trimmed;
}

async function presignObjectReference(
  env: Bindings,
  organizationId: string,
  object: ObjectReference
): Promise<string> {
  if (!isCloudObjectReference(object)) {
    throw new Error("Uploaded video is not stored in cloud object storage");
  }

  const [url] = await presignTosMediaDownloadUrls(env, {
    organizationId,
    references: [object],
    expiresInSeconds: 3600,
  });

  if (!url) {
    throw new Error("Failed to create a readable URL for the uploaded video");
  }

  return url;
}

export async function resolveSeedanceCheckVideoUrl(params: {
  readonly env: Bindings;
  readonly organizationId: string;
  readonly source: "url" | "resource" | "object";
  readonly url?: string;
  readonly resourceId?: string;
  readonly object?: ObjectReference;
}): Promise<string> {
  if (params.source === "url") {
    const url = params.url?.trim();
    if (!url) {
      throw new Error("Video URL is required");
    }
    return assertPublicVideoUrl(url);
  }

  if (params.source === "object") {
    if (!params.object) {
      throw new Error("Uploaded object reference is required");
    }
    return presignObjectReference(params.env, params.organizationId, params.object);
  }

  const resourceId = params.resourceId?.trim();
  if (!resourceId) {
    throw new Error("Resource id is required");
  }

  const db = createDatabase(params.env);
  const resolved = await resolveMediaResources(params.env, {
    organizationId: params.organizationId,
    resourceIds: [resourceId],
  });

  const entry = resolved.resolved.find((item) => item.resourceId === resourceId);
  if (!entry) {
    throw new Error("Video resource not found");
  }
  if (entry.generating) {
    throw new Error("Video resource is still generating");
  }
  if (entry.failed) {
    throw new Error("Video resource failed to generate");
  }

  if (entry.kind === "cloud") {
    if (!entry.url) {
      throw new Error("Cloud video resource has no readable URL");
    }
    return assertPublicVideoUrl(entry.url);
  }

  if (entry.kind === "ephemeral") {
    const upstreamUrl = entry.upstreamUrl ?? entry.url;
    if (!upstreamUrl) {
      throw new Error("Ephemeral video resource has no URL");
    }
    return assertPublicVideoUrl(upstreamUrl);
  }

  const catalogRows = await getMediaResourcesByIds(db, {
    organizationId: params.organizationId,
    resourceIds: [resourceId],
  });
  const catalogEntry = catalogRows[0];
  if (!catalogEntry?.storageKey) {
    throw new Error("Local video resource must be uploaded to cloud storage first");
  }

  const object: ObjectReference = {
    id: catalogEntry.id,
    mimeType: catalogEntry.mimeType,
    storageKey: catalogEntry.storageKey,
    storageBackend: "volcengine_tos",
  };

  return presignObjectReference(params.env, params.organizationId, object);
}
