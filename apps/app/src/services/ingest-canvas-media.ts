import {

  AI_AUDIO_NODE_TYPE,

  AI_IMAGE_NODE_TYPE,

  AI_VIDEO_NODE_TYPE,

  getMediaReferenceKey,

  type MediaReference,

} from "@dafthunk/types";

import type { Node as ReactFlowNode } from "@xyflow/react";



import type { WorkflowNodeType } from "@/components/workflow/workflow-types";

import { readAiAudioCardAudios } from "@/components/workflow/ai-audio-node-utils";

import { readAiImageCardImages } from "@/components/workflow/ai-image-node-utils";

import { readAiVideoCardVideos } from "@/components/workflow/ai-video-node-utils";

import { generateCacheResourceTiers } from "@/services/ai-media-cache-service";

import { notifyAiMediaCacheChanged } from "@/services/ai-media-cache-events";

import {

  ensureGenerativeMediaCached,

} from "@/services/stage-generative-media";



interface IngestCanvasMediaParams {

  readonly organizationId: string;

  readonly workflowId: string | undefined;

  readonly media: MediaReference;

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

  readonly blob?: Blob;

}



export async function ingestCanvasMedia(

  params: IngestCanvasMediaParams

): Promise<void> {

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

function ingestInFlightKey(params: IngestCanvasMediaParams): string | null {
  if (!params.workflowId) {
    return null;
  }
  return `${params.organizationId}:${params.workflowId}:${getMediaReferenceKey(params.media)}`;
}

const ingestInFlight = new Map<string, Promise<void>>();

export function ingestCanvasMediaInBackground(

  params: IngestCanvasMediaParams

): void {

  const key = ingestInFlightKey(params);
  if (!key) {
    return;
  }

  const existing = ingestInFlight.get(key);
  if (existing) {
    void existing.catch(() => {});
    return;
  }

  const promise = ingestCanvasMedia(params).finally(() => {
    ingestInFlight.delete(key);
  });
  ingestInFlight.set(key, promise);
  void promise.catch(() => {
    // Best-effort background ingest for canvas display.
  });

}



interface WorkflowMediaItem {

  readonly media: MediaReference;

  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";

}



export type { WorkflowMediaItem };



export function collectWorkflowCanvasMedia(

  nodes: readonly ReactFlowNode<WorkflowNodeType>[]

): readonly WorkflowMediaItem[] {

  const items: WorkflowMediaItem[] = [];

  const seen = new Set<string>();



  for (const node of nodes) {

    const data = node.data;

    const nodeType = data.nodeType ?? node.type ?? "";



    if (nodeType === AI_IMAGE_NODE_TYPE) {

      for (const media of readAiImageCardImages(

        data.inputs,

        data.outputs,

        data.metadata

      )) {

        const key = getMediaReferenceKey(media);

        if (seen.has(key)) continue;

        seen.add(key);

        items.push({ media, nodeType: "ai-image" });

      }

      continue;

    }



    if (nodeType === AI_VIDEO_NODE_TYPE) {

      for (const media of readAiVideoCardVideos(

        data.inputs,

        data.outputs,

        data.metadata

      )) {

        const key = getMediaReferenceKey(media);

        if (seen.has(key)) continue;

        seen.add(key);

        items.push({ media, nodeType: "ai-video" });

      }

      continue;

    }



    if (nodeType === AI_AUDIO_NODE_TYPE) {

      for (const media of readAiAudioCardAudios(

        data.inputs,

        data.outputs,

        data.metadata

      )) {

        const key = getMediaReferenceKey(media);

        if (seen.has(key)) continue;

        seen.add(key);

        items.push({ media, nodeType: "ai-audio" });

      }

    }

  }



  return items;

}



export function ingestWorkflowCanvasMediaInBackground(params: {

  readonly organizationId: string;

  readonly workflowId: string;

  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];

}): void {

  const items = collectWorkflowCanvasMedia(params.nodes);

  for (const item of items) {

    ingestCanvasMediaInBackground({

      organizationId: params.organizationId,

      workflowId: params.workflowId,

      media: item.media,

      nodeType: item.nodeType,

    });

  }

}


