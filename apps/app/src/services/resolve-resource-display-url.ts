import {
  getResourceIdFromValue,
  type MediaReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";

import {
  getCanvasTierUrlSet,
  getMediaDisplayUrlSet,
  getStableCanvasTierUrlSet,
  getStableMediaDisplayUrlSet,
  isMediaDisplayUrlSetEmpty,
  pickCanvasTierUrl,
  pickMediaDisplayUrl,
  type CanvasTierUrlSet,
  type MediaDisplayUrlSet,
} from "@/services/ai-media-cache-service";
import { isCanvasDisplaySize } from "@/services/media-display-size";
import type { MediaDisplaySize } from "@/services/media-display-size";
import { inferMediaNodeType } from "@/services/media-url-resolver";
import { ingestCanvasMediaInBackground } from "@/services/ingest-canvas-media";
import { registerWorkflowMediaFullUrl } from "@/services/workflow-media-address-catalog";
import { readGenerativeStagingBlob } from "@/services/generative-media-staging";

function resolveCanvasResourceId(params: {
  readonly media: WorkflowMediaValue;
}): string {
  const resourceId = getResourceIdFromValue(params.media);
  if (!resourceId) {
    throw new Error("Workflow media value has no resourceId");
  }
  return resourceId;
}

/** Sync lookup — all three canvas tier URLs must already exist in the stable registry. */
export function resolveStableCanvasTierUrlSet(params: {
  readonly media: WorkflowMediaValue;
  readonly organizationId: string;
  readonly workflowId: string;
}): CanvasTierUrlSet | null {
  const resourceId = resolveCanvasResourceId(params);
  return getStableCanvasTierUrlSet({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId: resourceId,
  });
}

export async function resolveCanvasTierUrlSet(params: {
  readonly media: WorkflowMediaValue;
  readonly organizationId: string;
  readonly workflowId: string;
}): Promise<CanvasTierUrlSet | null> {
  const resourceId = resolveCanvasResourceId(params);
  return getCanvasTierUrlSet({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId: resourceId,
  });
}

export function resolveStableMediaDisplayUrlSet(params: {
  readonly media: WorkflowMediaValue;
  readonly organizationId: string;
  readonly workflowId: string;
}): MediaDisplayUrlSet {
  const resourceId = resolveCanvasResourceId(params);
  return getStableMediaDisplayUrlSet({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId: resourceId,
  });
}

export async function resolveMediaDisplayUrlSet(params: {
  readonly media: WorkflowMediaValue;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";
}): Promise<MediaDisplayUrlSet> {
  const resourceId = resolveCanvasResourceId(params);
  const resolved = await getMediaDisplayUrlSet({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId: resourceId,
  });
  if (!isMediaDisplayUrlSetEmpty(resolved)) {
    return resolved;
  }

  const entry = await readGenerativeStagingBlob({
    mediaId: resourceId,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });
  if (entry) {
    const full = registerWorkflowMediaFullUrl({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      mediaId: resourceId,
      blob: entry.blob,
      preferStagingKey: true,
    });
    return { full, s: null, m: null, l: null };
  }

  return resolved;
}

export function resolveStableResourceDisplayUrl(params: {
  readonly media: WorkflowMediaValue;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly size?: MediaDisplaySize;
}): string | null {
  if (!params.size) {
    return null;
  }

  const set = resolveStableMediaDisplayUrlSet(params);
  return pickMediaDisplayUrl(set, params.size);
}

/** Canvas/studio display: local blob only — never return remote URLs. */
export async function resolveResourceDisplayUrl(params: {
  readonly media: WorkflowMediaValue;
  readonly organizationId: string;
  readonly workflowId: string;
  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";
  readonly size?: MediaDisplaySize;
}): Promise<string | null> {
  if (params.size && isCanvasDisplaySize(params.size)) {
    const set = await resolveMediaDisplayUrlSet(params);
    const url = pickMediaDisplayUrl(set, params.size);
    if (url) {
      return url;
    }

    const nodeType = params.nodeType ?? inferMediaNodeType(params.media);
    if (nodeType) {
      ingestCanvasMediaInBackground({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        media: params.media,
        nodeType,
      });
    }
    return null;
  }

  const set = await resolveMediaDisplayUrlSet(params);
  const local = params.size
    ? pickMediaDisplayUrl(set, params.size)
    : set.full;
  if (local) return local;

  const nodeType = params.nodeType ?? inferMediaNodeType(params.media);
  if (nodeType) {
    ingestCanvasMediaInBackground({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      media: params.media,
      nodeType,
    });
  }

  return null;
}

export {
  pickCanvasTierUrl,
  pickMediaDisplayUrl,
  type CanvasTierUrlSet,
  type MediaDisplayUrlSet,
};
