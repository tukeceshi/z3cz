import type {
  ObjectReference,
  ResourceIdReference,
  WorkflowMediaValue,
} from "@dafthunk/types";
import { isCloudObjectReference } from "@dafthunk/types";

import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";
import { allocateGenerativeMediaResourceId } from "@/services/allocate-generative-media-resource-id";
import { reportCloudStorageError } from "@/services/cloud-storage-error-reporter";
import { writeGenerativeStaging } from "@/services/generative-media-staging";
import { registerMediaResource } from "@/services/register-media-resource";
import { makeRequest } from "@/services/utils";

interface TosPresignUploadResponse {
  readonly uploadUrl: string;
  readonly uploadHeaders: Record<string, string>;
  readonly reference: ObjectReference;
}

export interface CloudUploadResult {
  readonly workflow: ResourceIdReference;
  readonly object: ObjectReference;
}

export class CloudObjectUploadFailedError extends Error {
  constructor(message = "Cloud upload failed") {
    super(message);
    this.name = "CloudObjectUploadFailedError";
  }
}

export class CloudCatalogRegisterFailedError extends Error {
  constructor(message = "Failed to register cloud media resource") {
    super(message);
    this.name = "CloudCatalogRegisterFailedError";
  }
}

export function requireStagingWorkflowId(workflowId: string | undefined): string {
  const trimmed = workflowId?.trim();
  if (!trimmed) {
    throw new Error("workflowId is required for media staging");
  }
  return trimmed;
}

async function stageBlobForUpload(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly resourceId: string;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}): Promise<void> {
  const stored = await writeGenerativeStaging({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId: params.resourceId,
    blob: params.blob,
    mimeType: params.mimeType,
    nodeType: params.nodeType,
  });
  if (!stored) {
    throw new Error("Failed to stage media in local cache");
  }
  notifyAiMediaCacheChanged();
}

async function registerCloudMediaResource(params: {
  readonly organizationId: string;
  readonly reference: ObjectReference;
}): Promise<void> {
  if (!isCloudObjectReference(params.reference)) {
    throw new CloudCatalogRegisterFailedError(
      "Cloud upload did not return a storage-backed reference"
    );
  }

  await registerMediaResource({
    organizationId: params.organizationId,
    id: params.reference.id,
    kind: "cloud",
    mimeType: params.reference.mimeType,
    storageKey: params.reference.storageKey,
  });
}

/** Stage and upload under a single pre-allocated resourceId. */
export async function uploadBlobToCloudStorage(params: {
  readonly organizationId: string;
  readonly workflowId: string | undefined;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio" | "reference";
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly resourceId?: string;
}): Promise<CloudUploadResult> {
  const workflowId = requireStagingWorkflowId(params.workflowId);
  const resourceId = params.resourceId?.trim() || allocateGenerativeMediaResourceId();

  await stageBlobForUpload({
    organizationId: params.organizationId,
    workflowId,
    resourceId,
    blob: params.blob,
    mimeType: params.mimeType,
    nodeType: params.nodeType,
  });

  const presign = await makeRequest<TosPresignUploadResponse>(
    `/${params.organizationId}/platform-ai/tos/presign-upload`,
    {
      method: "POST",
      body: JSON.stringify({
        mimeType: params.mimeType,
        contentLength: params.blob.size,
        workflowId,
        mediaKind: params.mediaKind,
        objectId: resourceId,
      }),
    }
  );

  const uploadHeaders: Record<string, string> = {
    ...presign.uploadHeaders,
    "Content-Type": params.mimeType,
  };
  delete uploadHeaders.Host;
  delete uploadHeaders.host;

  let cloudUploadOk = false;
  let uploadLooksLikeCors = false;
  try {
    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: uploadHeaders,
      body: params.blob,
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

  try {
    await registerCloudMediaResource({
      organizationId: params.organizationId,
      reference: presign.reference,
    });
  } catch (error) {
    if (error instanceof CloudCatalogRegisterFailedError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Failed to register cloud media resource";
    throw new CloudCatalogRegisterFailedError(message);
  }

  return {
    workflow: { resourceId, mimeType: params.mimeType, kind: "cloud" },
    object: presign.reference,
  };
}

export async function uploadBlobToCloudWorkflow(params: {
  readonly organizationId: string;
  readonly workflowId: string | undefined;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio" | "reference";
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly resourceId?: string;
}): Promise<WorkflowMediaValue> {
  const workflowId = requireStagingWorkflowId(params.workflowId);
  const resourceId = params.resourceId?.trim() || allocateGenerativeMediaResourceId();

  try {
    const result = await uploadBlobToCloudStorage({
      ...params,
      resourceId,
    });
    return result.workflow;
  } catch (error) {
    if (error instanceof CloudCatalogRegisterFailedError) {
      throw error;
    }

    if (!(error instanceof CloudObjectUploadFailedError)) {
      throw error;
    }

    try {
      await registerMediaResource({
        organizationId: params.organizationId,
        id: resourceId,
        kind: "local",
        mimeType: params.mimeType,
      });
    } catch {
      // Staging succeeded; catalog registration is best-effort for local-only fallback.
    }

    return {
      resourceId,
      mimeType: params.mimeType,
      kind: "local",
      cloudUploadFailed: true,
    };
  }
}
