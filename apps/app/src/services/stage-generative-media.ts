import type { LocalMediaReference, MediaReference, ObjectReference } from "@dafthunk/types";

import {

  getMediaReferenceKey,

  isLocalMediaReference,

  isObjectReference,

} from "@dafthunk/types";



import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";

import { cacheMediaFromUrl } from "@/services/ai-media-cache-service";

import {

  readGenerativeStagingBlob,

  writeGenerativeStaging,

  writeGenerativeStagingWithNewId,

} from "@/services/generative-media-staging";

import { makeRequest } from "@/services/utils";
import { reportCloudStorageError } from "@/services/cloud-storage-error-reporter";



interface TosPresignUploadResponse {

  readonly uploadUrl: string;

  readonly uploadHeaders: Record<string, string>;

  readonly reference: ObjectReference;

}



function platformAiEndpoint(organizationId: string): string {

  return `/${organizationId}/platform-ai`;

}



function inferNodeTypeFromMime(

  mimeType: string

): "ai-image" | "ai-video" | "ai-audio" {

  const mime = mimeType.toLowerCase();

  if (mime.startsWith("video/")) return "ai-video";

  if (mime.startsWith("audio/")) return "ai-audio";

  return "ai-image";

}



function inferNodeTypeFromMediaKind(

  mediaKind: "ai-image" | "ai-video" | "ai-audio" | "reference",

  mimeType: string

): "ai-image" | "ai-video" | "ai-audio" {

  if (mediaKind !== "reference") {

    return mediaKind;

  }

  return inferNodeTypeFromMime(mimeType);

}



export async function stageGenerativeMediaBlob(params: {

  readonly organizationId: string;

  readonly workflowId: string;

  readonly workflowName?: string;

  readonly mediaId: string;

  readonly blob: Blob;

  readonly mimeType: string;

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

}): Promise<boolean> {

  const cachedOk = await writeGenerativeStaging({

    organizationId: params.organizationId,

    workflowId: params.workflowId,

    workflowName: params.workflowName ?? params.workflowId,

    mediaId: params.mediaId,

    blob: params.blob,

    mimeType: params.mimeType,

    nodeType: params.nodeType,

  });

  if (cachedOk) {

    notifyAiMediaCacheChanged();

  }

  return cachedOk;

}



export async function uploadGenerativeMediaFile(params: {

  readonly organizationId: string;

  readonly workflowId?: string;

  readonly file: File;

  readonly cloudConfigured: boolean;

  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio" | "reference";

  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";

}): Promise<MediaReference> {

  const mimeType = params.file.type || "application/octet-stream";

  const workflowId = params.workflowId?.trim() || "uploads";

  const nodeType =

    params.nodeType ?? inferNodeTypeFromMediaKind(params.mediaKind, mimeType);



  if (!params.cloudConfigured) {

    const { mediaId } = await writeGenerativeStagingWithNewId({

      organizationId: params.organizationId,

      workflowId,

      blob: params.file,

      mimeType,

      nodeType,

    });

    notifyAiMediaCacheChanged();

    const localRef: LocalMediaReference = {

      kind: "local",

      mediaId,

      mimeType,

    };

    return localRef;

  }



  const presign = await makeRequest<TosPresignUploadResponse>(

    `${platformAiEndpoint(params.organizationId)}/tos/presign-upload`,

    {

      method: "POST",

      body: JSON.stringify({

        mimeType,

        contentLength: params.file.size,

        workflowId: params.workflowId,

        mediaKind: params.mediaKind,

      }),

    }

  );



  const mediaId = getMediaReferenceKey(presign.reference);

  await writeGenerativeStaging({

    organizationId: params.organizationId,

    workflowId,

    mediaId,

    blob: params.file,

    mimeType,

    nodeType,

  });

  notifyAiMediaCacheChanged();

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
  }

  if (cloudUploadOk) {
    return presign.reference;
  }

  const localRef: LocalMediaReference = {
    kind: "local",
    mediaId,
    mimeType,
  };
  return localRef;
}



/** Card upload: write staging first, then optionally persist to cloud. */

export async function stageGenerativeCardUpload(params: {

  readonly organizationId: string;

  readonly workflowId: string | undefined;

  readonly file: File;

  readonly cloudConfigured: boolean;

  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio";

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

}): Promise<MediaReference> {

  return uploadGenerativeMediaFile({

    organizationId: params.organizationId,

    workflowId: params.workflowId,

    file: params.file,

    cloudConfigured: params.cloudConfigured,

    mediaKind: params.mediaKind,

    nodeType: params.nodeType,

  });

}



export async function ensureGenerativeMediaCached(params: {

  readonly organizationId: string;

  readonly workflowId: string | undefined;

  readonly media: MediaReference;

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

  readonly blob?: Blob;

}): Promise<void> {

  if (!params.workflowId) return;



  const mediaId = getMediaReferenceKey(params.media);

  if (params.blob) {

    await stageGenerativeMediaBlob({

      organizationId: params.organizationId,

      workflowId: params.workflowId,

      mediaId,

      blob: params.blob,

      mimeType: params.media.mimeType,

      nodeType: params.nodeType,

    });

    return;

  }



  if (isLocalMediaReference(params.media)) {

    const entry = await readGenerativeStagingBlob({

      mediaId: params.media.mediaId,

      organizationId: params.organizationId,

      workflowId: params.workflowId,

    });

    if (entry) {

      await stageGenerativeMediaBlob({

        organizationId: params.organizationId,

        workflowId: params.workflowId,

        mediaId: params.media.mediaId,

        blob: entry.blob,

        mimeType: params.media.mimeType || entry.mimeType,

        nodeType: params.nodeType,

      });

    }

    return;

  }



  if (isObjectReference(params.media)) {

    const cachedOk = await cacheMediaFromUrl({

      organizationId: params.organizationId,

      workflowId: params.workflowId,

      workflowName: params.workflowId,

      media: params.media,

      nodeType: params.nodeType,

    });

    if (cachedOk) {

      notifyAiMediaCacheChanged();

    }

  }

}



export async function uploadGenerativeMediaFromLocalStaging(params: {

  readonly organizationId: string;

  readonly workflowId?: string;

  readonly mediaId: string;

  readonly mimeType: string;

  readonly mediaKind?: "ai-image" | "ai-video" | "ai-audio" | "reference";

}): Promise<ObjectReference> {

  const entry = await readGenerativeStagingBlob({

    mediaId: params.mediaId,

    organizationId: params.organizationId,

    workflowId: params.workflowId,

  });

  if (!entry) {

    throw new Error("AI staging blob not found");

  }



  const file = new File([entry.blob], `staged-${params.mediaId}`, {

    type: params.mimeType || entry.mimeType || "application/octet-stream",

  });



  const reference = await uploadGenerativeMediaFile({

    organizationId: params.organizationId,

    workflowId: params.workflowId,

    file,

    cloudConfigured: true,

    mediaKind: params.mediaKind ?? "reference",

  });



  if (!isObjectReference(reference)) {

    throw new Error("Expected cloud object reference after upload");

  }



  return reference;

}


