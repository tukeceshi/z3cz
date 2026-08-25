import {
  isCloudObjectReference,
  type ObjectReference,
} from "@dafthunk/types";

import { allocateGenerativeMediaResourceId } from "@/services/allocate-generative-media-resource-id";
import { reportCloudStorageError } from "@/services/cloud-storage-error-reporter";
import { registerMediaResource } from "@/services/register-media-resource";
import {
  CloudCatalogRegisterFailedError,
  CloudObjectUploadFailedError,
} from "@/services/upload-generative-media-cloud";
import { updateWorkflowListMetadata } from "@/services/workflow-service";
import { makeRequest } from "@/services/utils";

interface TosPresignUploadResponse {
  readonly uploadUrl: string;
  readonly uploadHeaders: Record<string, string>;
  readonly reference: ObjectReference;
}

export interface SetWorkflowCoverParams {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly resourceId: string;
  readonly mimeType: string;
  readonly replace?: boolean;
  readonly storageKey: string;
}

async function registerCoverResource(params: {
  readonly organizationId: string;
  readonly resourceId: string;
  readonly mimeType: string;
  readonly storageKey: string;
}): Promise<void> {
  await registerMediaResource({
    organizationId: params.organizationId,
    id: params.resourceId,
    kind: "cloud",
    mimeType: params.mimeType,
    storageKey: params.storageKey,
  });
}

export async function registerUploadedCoverReference(
  organizationId: string,
  reference: ObjectReference
): Promise<void> {
  if (!isCloudObjectReference(reference)) {
    throw new CloudCatalogRegisterFailedError(
      "Cover upload did not return a cloud storage reference"
    );
  }

  await registerCoverResource({
    organizationId,
    resourceId: reference.id,
    mimeType: reference.mimeType,
    storageKey: reference.storageKey,
  });
}

/** Upload a cover image to org cloud storage (TOS) — no platform object store. */
export async function uploadCoverImageToCloud(params: {
  readonly organizationId: string;
  readonly file: File;
}): Promise<ObjectReference> {
  const mimeType = params.file.type || "image/jpeg";
  const resourceId = allocateGenerativeMediaResourceId();

  const presign = await makeRequest<TosPresignUploadResponse>(
    `/${params.organizationId}/platform-ai/tos/presign-upload`,
    {
      method: "POST",
      body: JSON.stringify({
        mimeType,
        contentLength: params.file.size,
        mediaKind: "reference",
        objectId: resourceId,
      }),
    }
  );

  const uploadHeaders: Record<string, string> = {
    ...presign.uploadHeaders,
    "Content-Type": mimeType,
  };
  delete uploadHeaders.Host;
  delete uploadHeaders.host;

  let cloudUploadOk = false;
  let uploadLooksLikeCors = false;
  try {
    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: uploadHeaders,
      body: params.file,
    });
    cloudUploadOk = uploadResponse.ok;
  } catch {
    cloudUploadOk = false;
    uploadLooksLikeCors = true;
  }

  if (!cloudUploadOk) {
    reportCloudStorageError(uploadLooksLikeCors ? "cors_upload" : "api");
    throw new CloudObjectUploadFailedError();
  }

  if (!isCloudObjectReference(presign.reference)) {
    throw new CloudCatalogRegisterFailedError(
      "Cover upload did not return a cloud storage reference"
    );
  }

  return presign.reference;
}

export async function setWorkflowCover(
  params: SetWorkflowCoverParams
): Promise<void> {
  await registerCoverResource({
    organizationId: params.organizationId,
    resourceId: params.resourceId,
    mimeType: params.mimeType,
    storageKey: params.storageKey,
  });

  await updateWorkflowListMetadata(
    params.workflowId,
    {
      coverObjectId: params.resourceId,
      coverMimeType: params.mimeType,
      coverReplace: params.replace === true,
    },
    params.organizationId
  );
}

/** Auto cover — workflow media is already in the resource catalog. */
export async function setWorkflowCoverIfAbsent(
  params: Omit<SetWorkflowCoverParams, "replace" | "storageKey">
): Promise<void> {
  await updateWorkflowListMetadata(
    params.workflowId,
    {
      coverObjectId: params.resourceId,
      coverMimeType: params.mimeType,
      coverReplace: false,
    },
    params.organizationId
  );
}
