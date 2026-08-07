import type {
  LocalMediaReference,
  MediaReference,
  ObjectReference,
} from "@dafthunk/types";
import { getMediaReferenceKey } from "@dafthunk/types";

import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";
import { rekeyCacheEntry } from "@/services/ai-media-cache-service";
import { reportCloudStorageError } from "@/services/cloud-storage-error-reporter";
import { rekeyStableBlobUrlsForMediaId } from "@/services/media-display-blob-url-registry";
import { writeGenerativeStagingWithNewId } from "@/services/generative-media-staging";
import { dispatchMediaResourceRekeyed } from "@/services/media-resource-rekey-events";
import { rekeyMediaResourceCatalog } from "@/services/media-resource-service";
import { makeRequest } from "@/services/utils";

interface TosPresignUploadResponse {
  readonly uploadUrl: string;
  readonly uploadHeaders: Record<string, string>;
  readonly reference: ObjectReference;
}

export function requireStagingWorkflowId(workflowId: string | undefined): string {
  const trimmed = workflowId?.trim();
  if (!trimmed) {
    throw new Error("workflowId is required for media staging");
  }
  return trimmed;
}

async function rekeyStagingMediaToCloud(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly fromMediaId: string;
  readonly reference: ObjectReference;
}): Promise<void> {
  const toMediaId = getMediaReferenceKey(params.reference);
  if (params.fromMediaId === toMediaId) {
    return;
  }

  await rekeyCacheEntry({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    fromMediaId: params.fromMediaId,
    toMediaId,
  });
  rekeyStableBlobUrlsForMediaId({
    fromMediaId: params.fromMediaId,
    toMediaId,
  });
  dispatchMediaResourceRekeyed({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    fromMediaId: params.fromMediaId,
    toMediaReference: params.reference,
  });
  void rekeyMediaResourceCatalog({
    organizationId: params.organizationId,
    fromMediaId: params.fromMediaId,
    toMediaReference: params.reference,
  });
  notifyAiMediaCacheChanged();
}

/** Stage under a local mediaId first; on success rekey to cloud storageKey. */
export async function uploadBlobToCloudStorage(params: {
  readonly organizationId: string;
  readonly workflowId: string | undefined;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio" | "reference";
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly existingLocalMediaId?: string;
}): Promise<MediaReference> {
  const workflowId = requireStagingWorkflowId(params.workflowId);

  let localMediaId = params.existingLocalMediaId;
  if (!localMediaId) {
    const staged = await writeGenerativeStagingWithNewId({
      organizationId: params.organizationId,
      workflowId,
      blob: params.blob,
      mimeType: params.mimeType,
      nodeType: params.nodeType,
    });
    localMediaId = staged.mediaId;
    notifyAiMediaCacheChanged();
  }

  const presign = await makeRequest<TosPresignUploadResponse>(
    `/${params.organizationId}/platform-ai/tos/presign-upload`,
    {
      method: "POST",
      body: JSON.stringify({
        mimeType: params.mimeType,
        contentLength: params.blob.size,
        workflowId,
        mediaKind: params.mediaKind,
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
    const localRef: LocalMediaReference = {
      kind: "local",
      mediaId: localMediaId,
      mimeType: params.mimeType,
    };
    return localRef;
  }

  await rekeyStagingMediaToCloud({
    organizationId: params.organizationId,
    workflowId,
    fromMediaId: localMediaId,
    reference: presign.reference,
  });

  return presign.reference;
}
