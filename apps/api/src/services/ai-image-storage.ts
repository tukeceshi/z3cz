import type { CloudImageUploadTarget } from "@dafthunk/runtime/ai-interface/execute-volcano-image";
import type { ObjectReference } from "@dafthunk/types";

import type { Bindings } from "../context";
import { createDatabase } from "../db";
import { VolcengineTosClient } from "../integrations/volcengine/tos-client";
import { decryptSecret } from "../utils/encryption";
import { resolveOrgCloudStorage } from "./resolve-org-cloud-storage";
import { isTosRequestError } from "../integrations/volcengine/tos-errors";
import { recordCloudStorageHealthFromError } from "./probe-org-cloud-storage-health";

export type AiImageStorageMode = "ephemeral" | "cloud";

export interface AiImageStorageResolution {
  readonly storageMode: AiImageStorageMode;
  readonly cloudUpload?: CloudImageUploadTarget;
}

export async function resolveAiImageStorage(
  env: Bindings,
  params: {
    readonly organizationId: string;
    readonly workflowId?: string;
  }
): Promise<AiImageStorageResolution> {
  const db = createDatabase(env);
  const cloud = await resolveOrgCloudStorage(db, params.organizationId);

  if (!cloud) {
    return { storageMode: "ephemeral" };
  }

  const secretAccessKey = await decryptSecret(
    cloud.secretAccessKeyEncrypted,
    env,
    params.organizationId
  );

  const tosClient = new VolcengineTosClient({
    accessKeyId: cloud.accessKeyId,
    secretAccessKey,
    region: cloud.tosStorage.region,
    bucket: cloud.tosStorage.bucket,
  });

  const workflowId = params.workflowId?.trim() || "unknown";
  const prefix = cloud.tosStorage.prefix;

  const cloudUpload: CloudImageUploadTarget = {
    upload: async ({ workflowId: wfId, data, mimeType, objectId }) => {
      const storageKey = tosClient.buildObjectKey({
        prefix,
        workflowId: wfId,
        mediaKind: "ai-image",
        objectId,
        mimeType,
      });

      try {
        await tosClient.putObject({ key: storageKey, body: data, mimeType });
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

      const reference: ObjectReference = {
        id: objectId,
        mimeType,
        storageKey,
        storageBackend: "volcengine_tos",
      };
      return reference;
    },
  };

  void workflowId;

  return { storageMode: "cloud", cloudUpload };
}
