import type {
  MediaReference,
  MediaResourceRecord,
  RegisterMediaResourceRequest,
  RekeyMediaResourceRequest,
  ResolvedMediaResourceEntry,
  ResolveMediaResourcesResponse,
} from "@dafthunk/types";
import {
  getResourceId,
  isCloudObjectReference,
  isEphemeralMediaReference,
  isLocalMediaReference,
  isObjectReference,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase, type Database } from "../db";
import {
  getMediaResourcesByIds,
  rekeyMediaResource,
  upsertMediaResources,
  type UpsertMediaResourceParams,
} from "../db/media-resource-queries";
import { presignTosMediaDownloadUrls } from "./tos-media-presign";
import type { ObjectReference } from "@dafthunk/types";

function inferMimeTypeFromStorageKey(storageKey: string): string {
  const lower = storageKey.split("?")[0]?.toLowerCase() ?? "";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function objectIdFromStorageKey(storageKey: string): string {
  const segment = storageKey.split("/").pop() ?? storageKey;
  const dotIndex = segment.lastIndexOf(".");
  return dotIndex > 0 ? segment.slice(0, dotIndex) : segment;
}

function isLikelyStorageKey(resourceId: string): boolean {
  return resourceId.includes("/");
}

function toCloudReferenceFromStorageKey(storageKey: string): ObjectReference {
  return {
    id: objectIdFromStorageKey(storageKey),
    mimeType: inferMimeTypeFromStorageKey(storageKey),
    storageKey,
    storageBackend: "volcengine_tos",
  };
}

export function mediaReferenceToCatalogInsert(
  organizationId: string,
  ref: MediaReference
): UpsertMediaResourceParams | null {
  if (isLocalMediaReference(ref)) {
    return {
      id: ref.mediaId,
      organizationId,
      kind: "local",
      mimeType: ref.mimeType,
      storageKey: null,
    };
  }

  if (isEphemeralMediaReference(ref)) {
    return {
      id: ref.mediaId,
      organizationId,
      kind: "ephemeral",
      mimeType: ref.mimeType,
      storageKey: null,
    };
  }

  if (isObjectReference(ref) && isCloudObjectReference(ref)) {
    return {
      id: getResourceId(ref),
      organizationId,
      kind: "cloud",
      mimeType: ref.mimeType,
      storageKey: ref.storageKey,
    };
  }

  return null;
}

export function registerRequestToCatalogInsert(
  organizationId: string,
  resource: RegisterMediaResourceRequest
): UpsertMediaResourceParams {
  return {
    id: resource.id,
    organizationId,
    kind: resource.kind,
    mimeType: resource.mimeType,
    storageKey: resource.kind === "cloud" ? (resource.storageKey ?? null) : null,
  };
}

async function applyMediaResourceRegistration(
  db: Database,
  organizationId: string,
  resource: RegisterMediaResourceRequest
): Promise<string> {
  const row = registerRequestToCatalogInsert(organizationId, resource);
  const replacesResourceId = resource.replacesResourceId?.trim();

  if (replacesResourceId && replacesResourceId !== row.id) {
    await rekeyMediaResource(db, {
      organizationId,
      fromResourceId: replacesResourceId,
      toResourceId: row.id,
      kind: row.kind,
      mimeType: row.mimeType,
      storageKey: row.storageKey,
    });
    return row.id;
  }

  await upsertMediaResources(db, [row]);
  return row.id;
}

export async function registerMediaResources(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly resources: readonly RegisterMediaResourceRequest[];
  }
): Promise<readonly string[]> {
  const registered: string[] = [];
  for (const resource of params.resources) {
    registered.push(
      await applyMediaResourceRegistration(db, params.organizationId, resource)
    );
  }
  return registered;
}

export async function rekeyMediaResourceCatalogEntry(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly request: RekeyMediaResourceRequest;
  }
): Promise<void> {
  await rekeyMediaResource(db, {
    organizationId: params.organizationId,
    fromResourceId: params.request.fromResourceId,
    toResourceId: params.request.toResourceId,
    kind: params.request.kind,
    mimeType: params.request.mimeType,
    storageKey:
      params.request.kind === "cloud" ? (params.request.storageKey ?? null) : null,
  });
}

export interface MediaResourceTransition {
  readonly fromResourceId?: string;
  readonly reference: MediaReference;
}

export async function registerMediaResourceTransitions(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly transitions: readonly MediaResourceTransition[];
  }
): Promise<void> {
  for (const transition of params.transitions) {
    const row = mediaReferenceToCatalogInsert(
      params.organizationId,
      transition.reference
    );
    if (!row) continue;

    const fromResourceId = transition.fromResourceId?.trim();
    if (fromResourceId && fromResourceId !== row.id) {
      await rekeyMediaResource(db, {
        organizationId: params.organizationId,
        fromResourceId,
        toResourceId: row.id,
        kind: row.kind,
        mimeType: row.mimeType,
        storageKey: row.storageKey,
      });
      continue;
    }

    await upsertMediaResources(db, [row]);
  }
}

export async function registerMediaResourcesFromReferences(
  db: Database,
  params: {
    readonly organizationId: string;
    readonly references: readonly MediaReference[];
  }
): Promise<void> {
  await registerMediaResourceTransitions(db, {
    organizationId: params.organizationId,
    transitions: params.references.map((reference) => ({ reference })),
  });
}

function resolveCatalogEntryForRequestId(
  catalogRows: readonly MediaResourceRecord[],
  resourceId: string
): MediaResourceRecord | undefined {
  const byId = catalogRows.find((row) => row.id === resourceId);
  if (byId) return byId;
  return catalogRows.find((row) => row.storageKey === resourceId);
}

export async function resolveMediaResources(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly resourceIds: readonly string[];
  }
): Promise<ResolveMediaResourcesResponse> {
  const db = createDatabase(env);
  const trimmedIds = [
    ...new Set(
      params.resourceIds.map((id) => id.trim()).filter((id) => id.length > 0)
    ),
  ];

  if (trimmedIds.length === 0) {
    return { resolved: [], unresolved: [] };
  }

  const catalogRows = await getMediaResourcesByIds(db, {
    organizationId: params.organizationId,
    resourceIds: trimmedIds,
  });

  const resolved: ResolvedMediaResourceEntry[] = [];
  const unresolved: string[] = [];
  const legacyCloudRefs: ObjectReference[] = [];
  const legacyCloudResourceIds: string[] = [];

  for (const resourceId of trimmedIds) {
    const catalogEntry = resolveCatalogEntryForRequestId(catalogRows, resourceId);
    if (catalogEntry) {
      if (catalogEntry.kind === "cloud" && catalogEntry.storageKey) {
        legacyCloudRefs.push(
          toCloudReferenceFromStorageKey(catalogEntry.storageKey)
        );
        legacyCloudResourceIds.push(resourceId);
      } else {
        resolved.push({
          resourceId,
          kind: catalogEntry.kind,
          mimeType: catalogEntry.mimeType,
        });
      }
      continue;
    }

    if (isLikelyStorageKey(resourceId)) {
      legacyCloudRefs.push(toCloudReferenceFromStorageKey(resourceId));
      legacyCloudResourceIds.push(resourceId);
      continue;
    }

    unresolved.push(resourceId);
  }

  if (legacyCloudRefs.length > 0) {
    const urls = await presignTosMediaDownloadUrls(env, {
      organizationId: params.organizationId,
      references: legacyCloudRefs.filter(isCloudObjectReference),
    });

    const legacyUpserts: UpsertMediaResourceParams[] = [];

    for (let index = 0; index < legacyCloudRefs.length; index += 1) {
      const ref = legacyCloudRefs[index]!;
      const resourceId = legacyCloudResourceIds[index]!;
      const url = urls[index];
      if (!url || !ref.storageKey) {
        unresolved.push(resourceId);
        continue;
      }

      resolved.push({
        resourceId,
        kind: "cloud",
        mimeType: ref.mimeType,
        url,
      });

      const catalogEntry = resolveCatalogEntryForRequestId(catalogRows, resourceId);
      if (!catalogEntry || catalogEntry.kind !== "cloud") {
        legacyUpserts.push({
          id: getResourceId(ref),
          organizationId: params.organizationId,
          kind: "cloud",
          mimeType: ref.mimeType,
          storageKey: ref.storageKey,
        });
      }
    }

    if (legacyUpserts.length > 0) {
      await upsertMediaResources(db, legacyUpserts);
    }
  }

  return { resolved, unresolved };
}

export function partitionResolvedMediaResourcesByMime(
  resolved: readonly ResolvedMediaResourceEntry[]
): {
  readonly referenceImageUrls: readonly string[];
  readonly referenceVideoUrls: readonly string[];
  readonly referenceAudioUrls: readonly string[];
} {
  const referenceImageUrls: string[] = [];
  const referenceVideoUrls: string[] = [];
  const referenceAudioUrls: string[] = [];

  for (const entry of resolved) {
    if (!entry.url) continue;
    const mime = entry.mimeType.toLowerCase();
    if (mime.startsWith("video/")) {
      referenceVideoUrls.push(entry.url);
    } else if (mime.startsWith("audio/")) {
      referenceAudioUrls.push(entry.url);
    } else {
      referenceImageUrls.push(entry.url);
    }
  }

  return { referenceImageUrls, referenceVideoUrls, referenceAudioUrls };
}
