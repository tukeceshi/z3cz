import type {
  TextContentRegisterResponse,
  TextContentStageRequest,
  TextContentSyncEvent,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase, type Database } from "../db";
import {
  getMediaResourcesByIds,
  upsertMediaResources,
} from "../db/media-resource-queries";
import { VolcengineTosClient } from "../integrations/volcengine/tos-client";
import { isTosRequestError } from "../integrations/volcengine/tos-errors";
import { decryptSecret } from "../utils/encryption";
import {
  applyTextEditOps,
  sha256HexFromBytes,
  sha256HexFromText,
  syncOpsFromBaseToPending,
} from "../utils/text-content-utils";
import { recordCloudStorageHealthFromError } from "./probe-org-cloud-storage-health";
import { resolveOrgCloudStorage } from "./resolve-org-cloud-storage";
import {
  appendTextContentCacheOps,
  clearTextContentCacheEntry,
  getTextContentCacheEntry,
  listTextContentCacheEntries,
} from "./text-content-cache";
import {
  presignTosMediaDownloadUrls,
  presignTosMediaUpload,
} from "./tos-media-presign";

const MERGE_DEBOUNCE_MS = 30_000;

const mergeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function mergeTimerKey(organizationId: string, resourceId: string): string {
  return `${organizationId}:${resourceId}`;
}

async function createOrgTosClient(
  env: Bindings,
  organizationId: string
): Promise<VolcengineTosClient | null> {
  const db = createDatabase(env);
  const cloud = await resolveOrgCloudStorage(db, organizationId);
  if (!cloud) {
    return null;
  }

  const secretAccessKey = await decryptSecret(
    cloud.secretAccessKeyEncrypted,
    env,
    organizationId
  );

  return new VolcengineTosClient({
    accessKeyId: cloud.accessKeyId,
    secretAccessKey,
    region: cloud.tosStorage.region,
    bucket: cloud.tosStorage.bucket,
  });
}

async function fetchTosTextBytes(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly storageKey: string;
  }
): Promise<Uint8Array | null> {
  const client = await createOrgTosClient(env, params.organizationId);
  if (!client) {
    return null;
  }

  try {
    const object = await client.getObject({ key: params.storageKey });
    return object.data;
  } catch {
    return null;
  }
}

async function putTosTextBytes(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly storageKey: string;
    readonly mimeType: string;
    readonly body: Uint8Array;
  }
): Promise<void> {
  const client = await createOrgTosClient(env, params.organizationId);
  if (!client) {
    throw new Error("Cloud storage is not configured");
  }

  try {
    await client.putObject({
      key: params.storageKey,
      body: params.body,
      mimeType: params.mimeType,
    });
  } catch (error) {
    if (isTosRequestError(error)) {
      await recordCloudStorageHealthFromError(
        env,
        params.organizationId,
        error
      );
    }
    throw error;
  }
}

async function getCatalogRow(
  db: Database,
  organizationId: string,
  resourceId: string
) {
  const rows = await getMediaResourcesByIds(db, {
    organizationId,
    resourceIds: [resourceId],
  });
  return rows[0] ?? null;
}

export async function registerTextContentUpload(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly contentSha256: string;
    readonly mimeType: string;
    readonly contentLength: number;
    readonly workflowId?: string;
    readonly replacesResourceId?: string;
  }
): Promise<TextContentRegisterResponse | null> {
  const presigned = await presignTosMediaUpload(env, {
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mimeType: params.mimeType,
    contentLength: params.contentLength,
    mediaKind: "reference",
    replacesResourceId: params.replacesResourceId,
  });

  if (!presigned) {
    return null;
  }

  const db = createDatabase(env);
  await upsertMediaResources(db, [
    {
      id: presigned.reference.id,
      organizationId: params.organizationId,
      kind: "cloud",
      mimeType: params.mimeType,
      storageKey: presigned.reference.storageKey ?? null,
      contentSha256: params.contentSha256,
    },
  ]);

  return {
    resourceId: presigned.reference.id,
    uploadUrl: presigned.uploadUrl,
    uploadHeaders: presigned.uploadHeaders,
  };
}

export async function persistGeneratedTextContent(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly workflowId?: string;
    readonly text: string;
    readonly mimeType: string;
  }
): Promise<{ readonly resourceId: string; readonly contentSha256: string } | null> {
  const contentSha256 = sha256HexFromText(params.text);
  const bytes = new TextEncoder().encode(params.text);
  const registered = await registerTextContentUpload(env, {
    organizationId: params.organizationId,
    contentSha256,
    mimeType: params.mimeType,
    contentLength: bytes.byteLength,
    workflowId: params.workflowId,
  });

  if (!registered) {
    return null;
  }

  const db = createDatabase(env);
  const row = await getCatalogRow(
    db,
    params.organizationId,
    registered.resourceId
  );
  if (!row?.storageKey) {
    return null;
  }

  await putTosTextBytes(env, {
    organizationId: params.organizationId,
    storageKey: row.storageKey,
    mimeType: params.mimeType,
    body: bytes,
  });

  clearTextContentCacheEntry(params.organizationId, registered.resourceId);
  return { resourceId: registered.resourceId, contentSha256 };
}

export async function stageTextContentEdits(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly request: TextContentStageRequest;
  }
): Promise<{ readonly ok: true } | { readonly conflict: true; readonly dbSha256?: string }> {
  const db = createDatabase(env);
  const row = await getCatalogRow(
    db,
    params.organizationId,
    params.request.resourceId
  );
  if (!row) {
    return { conflict: true };
  }

  const dbSha = row.contentSha256 ?? undefined;
  if (dbSha && dbSha !== params.request.baseSha256) {
    return { conflict: true, dbSha256: dbSha };
  }

  appendTextContentCacheOps(params.organizationId, params.request.resourceId, {
    baseSha256: params.request.baseSha256,
    pendingSha256: params.request.pendingSha256,
    ops: params.request.ops,
  });

  scheduleTextContentMerge(env, {
    organizationId: params.organizationId,
    resourceId: params.request.resourceId,
  });

  return { ok: true };
}

export function scheduleTextContentMerge(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
    readonly immediate?: boolean;
  }
): void {
  const key = mergeTimerKey(params.organizationId, params.resourceId);
  const existing = mergeTimers.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  const delayMs = params.immediate ? 0 : MERGE_DEBOUNCE_MS;
  mergeTimers.set(
    key,
    setTimeout(() => {
      mergeTimers.delete(key);
      void mergeTextContentResource(env, params).catch((error) => {
        console.warn("[text-content] merge failed", error);
      });
    }, delayMs)
  );
}

export async function mergeTextContentResource(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
  }
): Promise<boolean> {
  const cache = getTextContentCacheEntry(
    params.organizationId,
    params.resourceId
  );
  if (!cache || cache.ops.length === 0) {
    return false;
  }

  const db = createDatabase(env);
  const row = await getCatalogRow(
    db,
    params.organizationId,
    params.resourceId
  );
  if (!row?.storageKey) {
    return false;
  }

  const dbSha = row.contentSha256 ?? cache.baseSha256;
  if (dbSha !== cache.baseSha256) {
    return false;
  }

  const baseBytes =
    (await fetchTosTextBytes(env, {
      organizationId: params.organizationId,
      storageKey: row.storageKey,
    })) ?? new Uint8Array();

  if (row.contentSha256 && sha256HexFromBytes(baseBytes) !== row.contentSha256) {
    return false;
  }

  const merged = applyTextEditOps(baseBytes, cache.ops);
  const mergedSha = sha256HexFromBytes(merged);
  if (mergedSha !== cache.pendingSha256) {
    return false;
  }

  await putTosTextBytes(env, {
    organizationId: params.organizationId,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    body: merged,
  });

  await upsertMediaResources(db, [
    {
      id: row.id,
      organizationId: params.organizationId,
      kind: row.kind,
      mimeType: row.mimeType,
      storageKey: row.storageKey,
      contentSha256: mergedSha,
    },
  ]);

  clearTextContentCacheEntry(params.organizationId, params.resourceId);
  return true;
}

export async function runDueTextContentMerges(env: Bindings): Promise<void> {
  const now = Date.now();
  for (const row of listTextContentCacheEntries()) {
    if (now - row.entry.updatedAt < MERGE_DEBOUNCE_MS) {
      continue;
    }
    await mergeTextContentResource(env, {
      organizationId: row.organizationId,
      resourceId: row.resourceId,
    });
  }
}

function encodeSyncEvent(event: TextContentSyncEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function streamTextContentSync(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
    readonly localSha?: string;
  }
): Promise<ReadableStream<Uint8Array>> {
  const db = createDatabase(env);
  const row = await getCatalogRow(
    db,
    params.organizationId,
    params.resourceId
  );

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: TextContentSyncEvent): void => {
        controller.enqueue(encodeSyncEvent(event));
      };

      if (!row) {
        send({ type: "conflict" });
        controller.close();
        return;
      }

      const dbSha = row.contentSha256 ?? "";
      const cache = getTextContentCacheEntry(
        params.organizationId,
        params.resourceId
      );

      if (!params.localSha) {
        if (!row.storageKey) {
          send({ type: "conflict", dbSha256: dbSha || undefined });
          controller.close();
          return;
        }

        const [downloadUrl] = await presignTosMediaDownloadUrls(env, {
          organizationId: params.organizationId,
          references: [
            {
              id: row.id,
              mimeType: row.mimeType,
              storageKey: row.storageKey,
              storageBackend: "volcengine_tos",
            },
          ],
        });

        send({ type: "download", downloadUrl, dbSha256: dbSha });
        controller.close();
        return;
      }

      if (!cache || cache.pendingSha256 === dbSha) {
        send({ type: "unchanged", dbSha256: dbSha });
        controller.close();
        return;
      }

      if (cache.baseSha256 !== dbSha) {
        send({ type: "conflict", dbSha256: dbSha || undefined });
        controller.close();
        return;
      }

      const baseBytes = row.storageKey
        ? ((await fetchTosTextBytes(env, {
            organizationId: params.organizationId,
            storageKey: row.storageKey,
          })) ?? new Uint8Array())
        : new Uint8Array();

      const pendingBytes = applyTextEditOps(baseBytes, cache.ops);
      if (sha256HexFromBytes(pendingBytes) !== cache.pendingSha256) {
        send({ type: "conflict", dbSha256: dbSha || undefined });
        controller.close();
        return;
      }

      const syncOps = syncOpsFromBaseToPending(baseBytes, pendingBytes);
      for (const op of syncOps) {
        if (op.op === "append") {
          send({ type: "append", text: op.text });
          continue;
        }
        send({
          type: "replace",
          start: op.start,
          end: op.end,
          text: op.text,
        });
      }

      send({ type: "done", pendingSha256: cache.pendingSha256 });
      controller.close();
    },
  });
}

export function flushTextContentMerge(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
  }
): void {
  scheduleTextContentMerge(env, { ...params, immediate: true });
}
