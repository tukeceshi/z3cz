import {
  getResourceIdFromValue,
  isResourceIdReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";



import { generateCacheResourceTiers } from "@/services/ai-media-cache-service";

import { notifyAiMediaCacheChanged } from "@/services/ai-media-cache-events";

import { readGenerativeStagingBlob } from "@/services/generative-media-staging";

import {
  ensureGenerativeMediaCached,
  uploadGenerativeMediaFromLocalStaging,
} from "@/services/stage-generative-media";
import { isResourceIdCloudResolvable } from "@/services/resolve-resource-ids-on-server";

export class LocalReferenceCloudUploadError extends Error {
  readonly resourceId: string;

  constructor(resourceId: string) {
    super(`Reference media is not in cloud storage: ${resourceId}`);
    this.name = "LocalReferenceCloudUploadError";
    this.resourceId = resourceId;
  }
}

function clearedCloudUploadFailed(
  item: WorkflowMediaValue
): WorkflowMediaValue {
  if (item.cloudUploadFailed !== true) {
    return item;
  }
  const { cloudUploadFailed: _ignored, ...rest } = item;
  return rest;
}

export async function ensureResourceCached(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly media: WorkflowMediaValue;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}): Promise<void> {

  if (!params.workflowId) return;



  await ensureGenerativeMediaCached(params);



  const mediaId = getResourceIdFromValue(params.media);

  if (!mediaId) return;



  if (params.nodeType === "ai-image" || params.nodeType === "ai-video") {

    await generateCacheResourceTiers({

      organizationId: params.organizationId,

      workflowId: params.workflowId,

      mediaId,

    });

    notifyAiMediaCacheChanged();

  }

}



export async function ensureResourcesCached(params: {

  readonly organizationId: string;

  readonly workflowId: string;

  readonly media: readonly WorkflowMediaValue[];

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

}): Promise<void> {

  for (const item of params.media) {

    await ensureResourceCached({

      organizationId: params.organizationId,

      workflowId: params.workflowId,

      media: item,

      nodeType: params.nodeType,

    });

  }

}



export function persistMediaForNodeInBackground(params: {

  readonly organizationId: string;

  readonly workflowId: string;

  readonly media: readonly WorkflowMediaValue[];

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

  readonly cloudConfigured: boolean;

}): void {

  if (params.media.length === 0) {

    return;

  }



  void runPersistMediaForNodeWork(params).catch(() => {

    // Best-effort background persist; display uses staged blobs.

  });

}



async function runPersistMediaForNodeWork(params: {

  readonly organizationId: string;

  readonly workflowId: string;

  readonly media: readonly WorkflowMediaValue[];

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

  readonly cloudConfigured: boolean;

}): Promise<void> {

  const refs = params.cloudConfigured

    ? await ensureLocalResourcesUploaded({

        organizationId: params.organizationId,

        workflowId: params.workflowId,

        media: params.media,

        cloudConfigured: true,

      })

    : [...params.media];



  await ensureResourcesCached({

    organizationId: params.organizationId,

    workflowId: params.workflowId,

    media: refs,

    nodeType: params.nodeType,

  });

}



export function prepareMediaForNodePersist(params: {

  readonly organizationId: string;

  readonly workflowId: string;

  readonly media: readonly WorkflowMediaValue[];

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

  readonly cloudConfigured: boolean;

}): readonly WorkflowMediaValue[] {

  persistMediaForNodeInBackground(params);

  return params.media;

}



export function ensureResourcesCachedInBackground(params: {

  readonly organizationId: string;

  readonly workflowId: string;

  readonly media: readonly WorkflowMediaValue[];

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

}): void {

  if (params.media.length === 0) return;

  void ensureResourcesCached(params).catch(() => {});

}



export async function ensureLocalResourcesUploaded(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly media: readonly WorkflowMediaValue[];
  readonly cloudConfigured: boolean;
}): Promise<WorkflowMediaValue[]> {
  if (!params.cloudConfigured) {
    return [...params.media];
  }

  const next: WorkflowMediaValue[] = [];

  for (const item of params.media) {
    const resourceId = getResourceIdFromValue(item);
    if (!resourceId) {
      next.push(item);
      continue;
    }

    const alreadyCloud = await isResourceIdCloudResolvable({
      organizationId: params.organizationId,
      resourceId,
    });
    if (alreadyCloud) {
      next.push(clearedCloudUploadFailed(item));
      continue;
    }

    const staging = await readGenerativeStagingBlob({
      mediaId: resourceId,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
    });
    if (!staging) {
      throw new LocalReferenceCloudUploadError(resourceId);
    }

    await uploadGenerativeMediaFromLocalStaging({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId: resourceId,
      mimeType: item.mimeType ?? staging.mimeType,
      objectId: resourceId,
    });

    const cloudReady = await isResourceIdCloudResolvable({
      organizationId: params.organizationId,
      resourceId,
    });
    if (!cloudReady) {
      throw new LocalReferenceCloudUploadError(resourceId);
    }

    next.push(clearedCloudUploadFailed(item));
  }

  return next;
}



export function collectResourceIds(

  media: readonly WorkflowMediaValue[]

): readonly string[] {

  return media

    .map((entry) => getResourceIdFromValue(entry))

    .filter((id): id is string => Boolean(id));

}



export function filterCloudResolvableReferences(

  media: readonly WorkflowMediaValue[]

): readonly WorkflowMediaValue[] {

  return media.filter((entry) => isResourceIdReference(entry));

}


