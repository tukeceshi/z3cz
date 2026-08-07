import { getMediaReferenceKey, type MediaReference } from "@dafthunk/types";



import {

  getCachedMediaBlobUrl,

  getCanvasTierUrlSet,

  getStableCanvasTierUrlSet,

  pickCanvasTierUrl,

  type CanvasTierUrlSet,

} from "@/services/ai-media-cache-service";

import { isCanvasDisplaySize } from "@/services/media-display-size";

import type { MediaDisplaySize } from "@/services/media-display-size";

import { inferMediaNodeType } from "@/services/media-url-resolver";

import { ingestCanvasMediaInBackground } from "@/services/ingest-canvas-media";

import {

  resolveCanonicalMediaReference,

  resolveCanonicalResourceId,

} from "@/services/media-resource-alias-service";



export function getResourceId(media: MediaReference): string {

  return getMediaReferenceKey(media);

}



function resolveCanvasResourceId(params: {

  readonly media: MediaReference;

  readonly organizationId: string;

  readonly workflowId: string;

}): string {

  return resolveCanonicalResourceId({

    media: params.media,

    organizationId: params.organizationId,

    workflowId: params.workflowId,

  });

}



/** Sync lookup — all three canvas tier URLs must already exist in the stable registry. */

export function resolveStableCanvasTierUrlSet(params: {

  readonly media: MediaReference;

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

  readonly media: MediaReference;

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



/** @deprecated Use resolveStableCanvasTierUrlSet and pickCanvasTierUrl. */

export function resolveStableResourceDisplayUrl(params: {

  readonly media: MediaReference;

  readonly organizationId: string;

  readonly workflowId: string;

  readonly size?: MediaDisplaySize;

}): string | null {

  if (!params.size || !isCanvasDisplaySize(params.size)) {

    return null;

  }



  const set = resolveStableCanvasTierUrlSet(params);

  if (!set) {

    return null;

  }



  if (params.size === "canvas-s" || params.size === "thumb") {

    return set.s;

  }

  if (params.size === "canvas-m") {

    return set.m;

  }

  return set.l;

}



/** Canvas/studio display: local blob only — never return remote URLs. */

export async function resolveResourceDisplayUrl(params: {

  readonly media: MediaReference;

  readonly organizationId: string;

  readonly workflowId: string;

  readonly nodeType?: "ai-image" | "ai-video" | "ai-audio";

  readonly size?: MediaDisplaySize;

}): Promise<string | null> {

  const canonicalMedia = resolveCanonicalMediaReference({

    media: params.media,

    organizationId: params.organizationId,

    workflowId: params.workflowId,

  });

  const resourceId = resolveCanvasResourceId(params);



  if (params.size && isCanvasDisplaySize(params.size)) {

    const set = await resolveCanvasTierUrlSet(params);

    if (set) {

      if (params.size === "canvas-s" || params.size === "thumb") {

        return set.s;

      }

      if (params.size === "canvas-m") {

        return set.m;

      }

      return set.l;

    }



    const nodeType = params.nodeType ?? inferMediaNodeType(canonicalMedia);

    if (nodeType) {

      ingestCanvasMediaInBackground({

        organizationId: params.organizationId,

        workflowId: params.workflowId,

        media: canonicalMedia,

        nodeType,

      });

    }

    return null;

  }



  const local = await getCachedMediaBlobUrl({

    organizationId: params.organizationId,

    workflowId: params.workflowId,

    mediaId: resourceId,

    size: params.size,

  });

  if (local) return local;



  const nodeType = params.nodeType ?? inferMediaNodeType(canonicalMedia);

  if (nodeType) {

    ingestCanvasMediaInBackground({

      organizationId: params.organizationId,

      workflowId: params.workflowId,

      media: canonicalMedia,

      nodeType,

    });

  }



  return null;

}



export { pickCanvasTierUrl, type CanvasTierUrlSet };

