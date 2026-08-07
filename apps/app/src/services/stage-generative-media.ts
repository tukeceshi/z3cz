import type { LocalMediaReference, MediaReference, ObjectReference } from "@dafthunk/types";

import {

  getMediaReferenceKey,

  isLocalMediaReference,

  isObjectReference,

  isEphemeralMediaReference,

} from "@dafthunk/types";



import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";

import { cacheMediaFromUrl } from "@/services/ai-media-cache-service";

import {
  readGenerativeStagingBlob,
  writeGenerativeStaging,
  writeGenerativeStagingWithNewId,
} from "@/services/generative-media-staging";
import {
  requireStagingWorkflowId,
  uploadBlobToCloudStorage,
} from "@/services/upload-generative-media-cloud";
import { buildMediaProxyEndpoint } from "@/services/media-cache-fetch-utils";



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

  const workflowId = requireStagingWorkflowId(params.workflowId);

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



  return uploadBlobToCloudStorage({

    organizationId: params.organizationId,

    workflowId,

    blob: params.file,

    mimeType,

    mediaKind: params.mediaKind,

    nodeType,

  });

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

      requireEnabled: false,

    });

    if (cachedOk) {

      notifyAiMediaCacheChanged();

    }

    return;

  }

  if (isEphemeralMediaReference(params.media)) {

    const cachedOk = await cacheMediaFromUrl({

      organizationId: params.organizationId,

      workflowId: params.workflowId,

      workflowName: params.workflowId,

      media: params.media,

      nodeType: params.nodeType,

      requireEnabled: false,

    });

    if (cachedOk) {

      notifyAiMediaCacheChanged();

    }

  }

}



export async function stageGenerativeMediaFromEphemeralUrl(params: {

  readonly organizationId: string;

  readonly workflowId: string;

  readonly sourceUrl: string;

  readonly mimeType: string;

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

}): Promise<LocalMediaReference> {

  const workflowId = requireStagingWorkflowId(params.workflowId);

  const fetchUrl = buildMediaProxyEndpoint(

    params.organizationId,

    params.sourceUrl,

    params.mimeType

  );

  const response = await fetch(fetchUrl, { credentials: "include" });

  if (!response.ok) {

    throw new Error(`Failed to download generated media (${response.status})`);

  }

  const blob = await response.blob();

  const mimeType =

    params.mimeType ||

    blob.type ||

    (params.nodeType === "ai-video"

      ? "video/mp4"

      : params.nodeType === "ai-audio"

        ? "audio/mpeg"

        : "image/png");



  const { mediaId } = await writeGenerativeStagingWithNewId({

    organizationId: params.organizationId,

    workflowId,

    blob,

    mimeType,

    nodeType: params.nodeType,

  });

  notifyAiMediaCacheChanged();

  return { kind: "local", mediaId, mimeType };

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



  const mimeType = params.mimeType || entry.mimeType || "application/octet-stream";

  const nodeType = inferNodeTypeFromMediaKind(

    params.mediaKind ?? "reference",

    mimeType

  );



  const reference = await uploadBlobToCloudStorage({

    organizationId: params.organizationId,

    workflowId: params.workflowId,

    blob: entry.blob,

    mimeType,

    mediaKind: params.mediaKind ?? "reference",

    nodeType,

    existingLocalMediaId: params.mediaId,

  });



  if (!isObjectReference(reference)) {

    throw new Error("Expected cloud object reference after upload");

  }



  return reference;

}


