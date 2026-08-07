import {
  getMediaReferenceKey,
  isLocalMediaReference,
  isObjectReference,
  type MediaReference,
} from "@dafthunk/types";

import { generateCacheResourceTiers } from "@/services/ai-media-cache-service";
import { notifyAiMediaCacheChanged } from "@/services/ai-media-cache-events";
import { readGenerativeStagingBlob } from "@/services/generative-media-staging";
import {
  ensureGenerativeMediaCached,
  stageGenerativeMediaBlob,
  uploadGenerativeMediaFromLocalStaging,
} from "@/services/stage-generative-media";

export async function ensureResourceCached(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly media: MediaReference;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}): Promise<void> {
  if (!params.workflowId) return;

  await ensureGenerativeMediaCached(params);

  const mediaId = getMediaReferenceKey(params.media);
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
  readonly media: readonly MediaReference[];
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

/** Cloud upload (if needed) + cache warm + tiers — does not block node updates. */
export function persistMediaForNodeInBackground(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly media: readonly MediaReference[];
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
  readonly media: readonly MediaReference[];
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

/** @deprecated Use persistMediaForNodeInBackground and write the node immediately. */
export function prepareMediaForNodePersist(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly media: readonly MediaReference[];
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly cloudConfigured: boolean;
}): readonly MediaReference[] {
  persistMediaForNodeInBackground(params);
  return params.media;
}

/** Warm cache and tier thumbs without blocking canvas/node updates. */
export function ensureResourcesCachedInBackground(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly media: readonly MediaReference[];
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
}): void {
  if (params.media.length === 0) return;
  void ensureResourcesCached(params).catch(() => {
    // Best-effort background cache; display already uses staged blobs.
  });
}

/** Upload browser-local resources so the server can resolve them by resourceId. */
export async function ensureLocalResourcesUploaded(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly media: readonly MediaReference[];
  readonly cloudConfigured: boolean;
}): Promise<MediaReference[]> {
  if (!params.cloudConfigured) {
    return [...params.media];
  }

  const next: MediaReference[] = [];

  for (const item of params.media) {
    if (!isLocalMediaReference(item)) {
      next.push(item);
      continue;
    }

    const staging = await readGenerativeStagingBlob({
      mediaId: item.mediaId,
      organizationId: params.organizationId,
      workflowId: params.workflowId,
    });
    if (!staging) {
      throw new Error("Local resource is missing from this browser");
    }

    const cloudRef = await uploadGenerativeMediaFromLocalStaging({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId: item.mediaId,
      mimeType: item.mimeType,
    });

    await stageGenerativeMediaBlob({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId: getMediaReferenceKey(cloudRef),
      blob: staging.blob,
      mimeType: item.mimeType,
      nodeType: item.mimeType.startsWith("video/")
        ? "ai-video"
        : item.mimeType.startsWith("audio/")
          ? "ai-audio"
          : "ai-image",
    });

    next.push(cloudRef);
  }

  return next;
}

export function collectResourceIds(
  media: readonly MediaReference[]
): readonly string[] {
  return media.map((entry) => getMediaReferenceKey(entry));
}

export function isCloudResolvableResourceId(resourceId: string): boolean {
  return resourceId.includes("/");
}

export function filterCloudResolvableReferences(
  media: readonly MediaReference[]
): readonly MediaReference[] {
  return media.filter((entry) => {
    if (isObjectReference(entry)) {
      return Boolean(entry.storageKey?.includes("/"));
    }
    return isCloudResolvableResourceId(getMediaReferenceKey(entry));
  });
}
