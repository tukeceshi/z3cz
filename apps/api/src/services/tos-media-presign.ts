import type { MediaReference, ObjectReference } from "@dafthunk/types";
import { v7 as uuid } from "uuid";

import { VolcengineTosClient } from "../integrations/volcengine/tos-client";
import { decryptSecret } from "../utils/encryption";
import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { resolveOrgCloudStorage } from "./resolve-org-cloud-storage";

const DEFAULT_PRESIGN_SECONDS = 3600;

async function createOrgTosClient(
  env: Bindings,
  organizationId: string
): Promise<VolcengineTosClient | null> {
  const db = createDatabase(env);
  const cloud = await resolveOrgCloudStorage(db, organizationId);
  if (!cloud) return null;

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

export interface TosPresignUploadResult {
  readonly uploadUrl: string;
  readonly uploadHeaders: Record<string, string>;
  readonly reference: ObjectReference;
}

export async function presignTosMediaUpload(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly workflowId?: string;
    readonly mimeType: string;
    readonly contentLength: number;
    readonly mediaKind: "ai-image" | "ai-video" | "reference";
  }
): Promise<TosPresignUploadResult | null> {
  const db = createDatabase(env);
  const cloud = await resolveOrgCloudStorage(db, params.organizationId);
  if (!cloud) return null;

  const client = await createOrgTosClient(env, params.organizationId);
  if (!client) return null;

  const objectId = uuid();
  const workflowId = params.workflowId?.trim() || "uploads";
  const storageKey = client.buildObjectKey({
    prefix: cloud.tosStorage.prefix,
    workflowId,
    mediaKind:
      params.mediaKind === "reference" ? "ai-image" : params.mediaKind,
    objectId,
    mimeType: params.mimeType,
  });

  const signed = await client.signPutObjectUpload({
    key: storageKey,
    mimeType: params.mimeType,
    contentLength: params.contentLength,
  });

  return {
    uploadUrl: signed.url,
    uploadHeaders: signed.headers,
    reference: {
      id: objectId,
      mimeType: params.mimeType,
      storageKey,
      storageBackend: "volcengine_tos",
    },
  };
}

export async function presignTosMediaDownloadUrls(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly references: readonly ObjectReference[];
    readonly expiresInSeconds?: number;
  }
): Promise<readonly string[]> {
  const client = await createOrgTosClient(env, params.organizationId);
  if (!client) {
    throw new Error("Cloud storage is not configured");
  }

  const expiresInSeconds = params.expiresInSeconds ?? DEFAULT_PRESIGN_SECONDS;
  const urls: string[] = [];

  for (const ref of params.references) {
    if (ref.storageBackend !== "volcengine_tos" || !ref.storageKey) {
      throw new Error("Reference is not stored in cloud object storage");
    }
    urls.push(
      await client.presignGetObjectUrl({
        key: ref.storageKey,
        expiresInSeconds,
      })
    );
  }

  return urls;
}

export function isTosMediaReference(
  ref: MediaReference
): ref is ObjectReference & { readonly storageKey: string } {
  return (
    "storageBackend" in ref &&
    ref.storageBackend === "volcengine_tos" &&
    typeof ref.storageKey === "string" &&
    ref.storageKey.length > 0
  );
}
