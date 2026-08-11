import type {

  LocalMediaReference,

  ObjectReference,

  ResourceIdReference,

  WorkflowMediaValue,

} from "@dafthunk/types";

import { getMediaReferenceKey } from "@dafthunk/types";



import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";

import { rekeyCacheEntry } from "@/services/ai-media-cache-service";

import { reportCloudStorageError } from "@/services/cloud-storage-error-reporter";

import { rekeyStableBlobUrlsForMediaId } from "@/services/media-display-blob-url-registry";

import { writeGenerativeStagingWithNewId } from "@/services/generative-media-staging";

import { dispatchMediaResourceRekeyed } from "@/services/media-resource-rekey-events";

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

    toMediaReference: {
      resourceId: toMediaId,
      mimeType: params.reference.mimeType,
    },

  });

  notifyAiMediaCacheChanged();

}



/** Stage under a local mediaId first; on success rekey cache to cloud resourceId. */

export async function uploadBlobToCloudStorage(params: {

  readonly organizationId: string;

  readonly workflowId: string | undefined;

  readonly blob: Blob;

  readonly mimeType: string;

  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio" | "reference";

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

  readonly existingLocalMediaId?: string;

}): Promise<CloudUploadResult> {

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

    throw new Error("Cloud upload failed");

  }



  await rekeyStagingMediaToCloud({

    organizationId: params.organizationId,

    workflowId,

    fromMediaId: localMediaId,

    reference: presign.reference,

  });



  const resourceId = getMediaReferenceKey(presign.reference);

  return {

    workflow: { resourceId, mimeType: params.mimeType },

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

  readonly existingLocalMediaId?: string;

}): Promise<WorkflowMediaValue> {

  try {

    const result = await uploadBlobToCloudStorage(params);

    return result.workflow;

  } catch {

    const workflowId = requireStagingWorkflowId(params.workflowId);

    const localMediaId =

      params.existingLocalMediaId ??

      (

        await writeGenerativeStagingWithNewId({

          organizationId: params.organizationId,

          workflowId,

          blob: params.blob,

          mimeType: params.mimeType,

          nodeType: params.nodeType,

        })

      ).mediaId;

    notifyAiMediaCacheChanged();

    const localRef: LocalMediaReference = {

      kind: "local",

      mediaId: localMediaId,

      mimeType: params.mimeType,

    };

    return localRef;

  }

}


