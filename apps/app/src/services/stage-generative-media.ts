import type {
  MediaReference,
  ObjectReference,
  PatchNodeLayoutMetadata,
  ResourceIdReference,
  WorkflowMediaValue,
} from "@dafthunk/types";

import {
  getResourceIdFromValue,
  isResourceIdReference,
  mediaReferenceToWorkflowValue,
} from "@dafthunk/types";

import { notifyAiMediaCacheChanged } from "@/hooks/use-ai-media-cache";
import { allocateGenerativeMediaResourceId } from "@/services/allocate-generative-media-resource-id";
import {
  cacheMediaFromUrl,
  getCachedMediaBlob,
} from "@/services/ai-media-cache-service";
import {
  commitNodeLayoutFromStaging,
  readGenerativeStagingBlob,
  writeGenerativeStaging,
  writeGenerativeStagingWithResourceId,
} from "@/services/generative-media-staging";
import { buildMediaProxyEndpoint } from "@/services/media-cache-fetch-utils";
import { registerMediaResource } from "@/services/register-media-resource";
import {
  requireStagingWorkflowId,
  uploadBlobToCloudStorage,
  uploadBlobToCloudWorkflow,
} from "@/services/upload-generative-media-cloud";

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
  readonly patchNodeLayout?: PatchNodeLayoutMetadata;
}): Promise<boolean> {
  const cachedOk = await writeGenerativeStaging({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    workflowName: params.workflowName ?? params.workflowId,
    mediaId: params.mediaId,
    blob: params.blob,
    mimeType: params.mimeType,
    nodeType: params.nodeType,
    patchNodeLayout: params.patchNodeLayout,
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
  readonly patchNodeLayout?: PatchNodeLayoutMetadata;
}): Promise<WorkflowMediaValue> {
  const mimeType = params.file.type || "application/octet-stream";
  const workflowId = requireStagingWorkflowId(params.workflowId);
  const nodeType =
    params.nodeType ?? inferNodeTypeFromMediaKind(params.mediaKind, mimeType);

  if (!params.cloudConfigured) {
    const resourceId = allocateGenerativeMediaResourceId();
    await writeGenerativeStagingWithResourceId({
      organizationId: params.organizationId,
      workflowId,
      resourceId,
      blob: params.file,
      mimeType,
      nodeType,
      patchNodeLayout: params.patchNodeLayout,
    });
    notifyAiMediaCacheChanged();
    await registerMediaResource({
      organizationId: params.organizationId,
      id: resourceId,
      kind: "local",
      mimeType,
    });
    return { resourceId, mimeType, kind: "local" };
  }

  return uploadBlobToCloudWorkflow({
    organizationId: params.organizationId,
    workflowId,
    blob: params.file,
    mimeType,
    mediaKind: params.mediaKind,
    nodeType,
  });
}

export async function stageGenerativeCardUpload(params: {
  readonly organizationId: string;
  readonly workflowId: string | undefined;
  readonly file: File;
  readonly cloudConfigured: boolean;
  readonly mediaKind: "ai-image" | "ai-video" | "ai-audio";
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly patchNodeLayout?: PatchNodeLayoutMetadata;
}): Promise<WorkflowMediaValue> {
  return uploadGenerativeMediaFile({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    file: params.file,
    cloudConfigured: params.cloudConfigured,
    mediaKind: params.mediaKind,
    nodeType: params.nodeType,
    patchNodeLayout: params.patchNodeLayout,
  });
}

export async function ensureGenerativeMediaCached(params: {
  readonly organizationId: string;
  readonly workflowId: string | undefined;
  readonly media: WorkflowMediaValue;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly blob?: Blob;
  readonly patchNodeLayout?: PatchNodeLayoutMetadata;
}): Promise<void> {
  if (!params.workflowId) return;

  const mediaId = getResourceIdFromValue(params.media);
  if (!mediaId) return;

  if (params.blob) {
    await stageGenerativeMediaBlob({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId,
      blob: params.blob,
      mimeType:
        params.media.mimeType || params.blob.type || "application/octet-stream",
      nodeType: params.nodeType,
      patchNodeLayout: params.patchNodeLayout,
    });
    return;
  }

  if (isResourceIdReference(params.media)) {
    if (
      params.media.cloudAccelerationStatus === "pending" ||
      params.media.cloudAccelerationStatus === "active"
    ) {
      return;
    }

    const existingBlob = await getCachedMediaBlob({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId,
    });
    if (existingBlob) {
      return;
    }

    const staged = await readGenerativeStagingBlob({
      mediaId,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
    });
    if (staged) {
      await stageGenerativeMediaBlob({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        mediaId,
        blob: staged.blob,
        mimeType: params.media.mimeType || staged.mimeType,
        nodeType: params.nodeType,
        patchNodeLayout: params.patchNodeLayout,
      });
      return;
    }

    const cachedOk = await cacheMediaFromUrl({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      workflowName: params.workflowId,
      media: params.media,
      nodeType: params.nodeType,
    });
    if (cachedOk) {
      notifyAiMediaCacheChanged();
      await commitNodeLayoutFromStaging({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        mediaId,
        nodeType: params.nodeType,
        patchNodeLayout: params.patchNodeLayout,
      });
    }
  }
}

export async function stageGenerativeMediaFromEphemeralUrl(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly sourceUrl: string;
  readonly mimeType: string;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly patchNodeLayout?: PatchNodeLayoutMetadata;
}): Promise<ResourceIdReference> {
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

  const resourceId = allocateGenerativeMediaResourceId();
  await writeGenerativeStagingWithResourceId({
    organizationId: params.organizationId,
    workflowId,
    resourceId,
    blob,
    mimeType,
    nodeType: params.nodeType,
    patchNodeLayout: params.patchNodeLayout,
  });
  notifyAiMediaCacheChanged();
  await registerMediaResource({
    organizationId: params.organizationId,
    id: resourceId,
    kind: "local",
    mimeType,
  });
  return { resourceId, mimeType, kind: "local" };
}

/** Job persist complete — returns object ref for server validation. */
export async function uploadGenerativeMediaFromLocalStaging(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly mediaId: string;
  readonly mimeType: string;
  readonly mediaKind?: "ai-image" | "ai-video" | "ai-audio" | "reference";
  readonly objectId?: string;
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

  const result = await uploadBlobToCloudStorage({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    blob: entry.blob,
    mimeType,
    mediaKind: params.mediaKind ?? "reference",
    nodeType,
    resourceId: params.objectId ?? params.mediaId,
  });

  return result.object;
}

/** Cloud object → workflow JSON; resourceId is catalog UUID (ObjectReference.id). */
export function cloudUploadToResourceId(
  object: ObjectReference
): ResourceIdReference {
  return mediaReferenceToWorkflowValue(object);
}
