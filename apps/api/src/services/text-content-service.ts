import type { TextContentSyncEvent } from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase, type Database } from "../db";
import {
  getMediaResourcesByIds,
  upsertMediaResources,
} from "../db/media-resource-queries";
import { VolcengineTosClient } from "../integrations/volcengine/tos-client";
import { isTosRequestError } from "../integrations/volcengine/tos-errors";
import { decryptSecret } from "../utils/encryption";
import { sha256HexFromText } from "../utils/text-content-utils";
import { recordCloudStorageHealthFromError } from "./probe-org-cloud-storage-health";
import { resolveOrgCloudStorage } from "./resolve-org-cloud-storage";
import { presignTosMediaDownloadUrls, presignTosMediaUpload } from "./tos-media-presign";

export interface SaveTextContentParams {
  readonly organizationId: string;
  readonly text: string;
  readonly mimeType: string;
  readonly workflowId?: string;
  readonly resourceId?: string;
  readonly baseSha256?: string;
}

export type SaveTextContentResult =
  | { readonly resourceId: string; readonly contentSha256: string }
  | { readonly conflict: true; readonly dbSha256?: string }
  | null;

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

async function allocateTextContentStorage(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly contentSha256: string;
    readonly mimeType: string;
    readonly contentLength: number;
    readonly workflowId?: string;
    readonly objectId?: string;
  }
): Promise<{ readonly resourceId: string; readonly storageKey: string } | null> {
  const presigned = await presignTosMediaUpload(env, {
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mimeType: params.mimeType,
    contentLength: params.contentLength,
    mediaKind: "reference",
    objectId: params.objectId,
  });

  if (!presigned?.reference.storageKey) {
    return null;
  }

  const db = createDatabase(env);
  await upsertMediaResources(db, [
    {
      id: presigned.reference.id,
      organizationId: params.organizationId,
      kind: "cloud",
      mimeType: params.mimeType,
      storageKey: presigned.reference.storageKey,
      contentSha256: params.contentSha256,
    },
  ]);

  return {
    resourceId: presigned.reference.id,
    storageKey: presigned.reference.storageKey,
  };
}

export function isTextContentSaveConflict(
  result: SaveTextContentResult
): result is { readonly conflict: true; readonly dbSha256?: string } {
  return Boolean(result && "conflict" in result && result.conflict);
}

/** Write full text on the server. Browser never PUTs to object storage. */
export async function saveTextContent(
  env: Bindings,
  params: SaveTextContentParams
): Promise<SaveTextContentResult> {
  const contentSha256 = sha256HexFromText(params.text);
  const bytes = new TextEncoder().encode(params.text);
  const db = createDatabase(env);

  if (params.resourceId) {
    const row = await getCatalogRow(
      db,
      params.organizationId,
      params.resourceId
    );
    if (
      row &&
      params.baseSha256 &&
      row.contentSha256 &&
      row.contentSha256 !== params.baseSha256
    ) {
      return { conflict: true, dbSha256: row.contentSha256 };
    }

    if (row?.storageKey) {
      if (row.contentSha256 === contentSha256) {
        return { resourceId: row.id, contentSha256 };
      }

      await putTosTextBytes(env, {
        organizationId: params.organizationId,
        storageKey: row.storageKey,
        mimeType: params.mimeType,
        body: bytes,
      });
      await upsertMediaResources(db, [
        {
          id: row.id,
          organizationId: params.organizationId,
          kind: row.kind,
          mimeType: params.mimeType,
          storageKey: row.storageKey,
          contentSha256,
        },
      ]);
      return { resourceId: row.id, contentSha256 };
    }
  }

  const allocated = await allocateTextContentStorage(env, {
    organizationId: params.organizationId,
    contentSha256,
    mimeType: params.mimeType,
    contentLength: Math.max(bytes.byteLength, 1),
    workflowId: params.workflowId,
    objectId: params.resourceId,
  });
  if (!allocated) {
    return null;
  }

  await putTosTextBytes(env, {
    organizationId: params.organizationId,
    storageKey: allocated.storageKey,
    mimeType: params.mimeType,
    body: bytes,
  });

  return { resourceId: allocated.resourceId, contentSha256 };
}

export async function persistGeneratedTextContent(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly workflowId?: string;
    readonly text: string;
    readonly mimeType: string;
    readonly resourceId?: string;
  }
): Promise<{ readonly resourceId: string; readonly contentSha256: string } | null> {
  const result = await saveTextContent(env, {
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    text: params.text,
    mimeType: params.mimeType,
    resourceId: params.resourceId,
  });

  if (!result || isTextContentSaveConflict(result)) {
    return null;
  }

  return result;
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
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      if (!row?.storageKey) {
        send({ type: "missing" });
        controller.close();
        return;
      }

      const dbSha = row.contentSha256 ?? "";
      if (params.localSha && params.localSha === dbSha) {
        send({ type: "unchanged", dbSha256: dbSha });
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
    },
  });
}

/** Read stored text body for workflow/runtime keyword resolution. */
export async function readTextContentBody(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly resourceId: string;
  }
): Promise<string | null> {
  const db = createDatabase(env);
  const row = await getCatalogRow(
    db,
    params.organizationId,
    params.resourceId
  );
  if (!row?.storageKey) {
    return null;
  }

  const baseBytes = await fetchTosTextBytes(env, {
    organizationId: params.organizationId,
    storageKey: row.storageKey,
  });
  if (!baseBytes || baseBytes.byteLength === 0) {
    return null;
  }

  return new TextDecoder().decode(baseBytes);
}
