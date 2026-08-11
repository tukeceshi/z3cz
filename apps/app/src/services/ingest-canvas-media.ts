import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  getResourceIdFromValue,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import type { WorkflowNodeType } from "@/components/workflow/workflow-types";
import { readAiAudioCardAudios } from "@/components/workflow/ai-audio-node-utils";
import { readAiImageCardImages } from "@/components/workflow/ai-image-node-utils";
import { readAiVideoCardVideos } from "@/components/workflow/ai-video-node-utils";
import { getCachedMediaBlob } from "@/services/ai-media-cache-service";
import {
  coordinateIngestCanvasMedia,
  type IngestCanvasMediaParams,
} from "@/services/media-ingest-coordinator";

export type { IngestCanvasMediaParams };

export async function ingestCanvasMedia(
  params: IngestCanvasMediaParams
): Promise<void> {
  await coordinateIngestCanvasMedia(params);

  const mediaId = getResourceIdFromValue(params.media);
  if (!mediaId || !params.workflowId) {
    return;
  }

  const cached = await getCachedMediaBlob({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId,
  });
  if (!cached && !params.blob) {
    throw new Error("Media ingest failed");
  }
}

export function ingestCanvasMediaInBackground(
  params: IngestCanvasMediaParams
): void {
  void coordinateIngestCanvasMedia(params).catch(() => {
    // Best-effort background ingest for canvas display.
  });
}

interface WorkflowMediaItem {
  readonly media: WorkflowMediaValue;
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
        const key = getResourceIdFromValue(media);
        if (!key || seen.has(key)) continue;
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
        const key = getResourceIdFromValue(media);
        if (!key || seen.has(key)) continue;
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
        const key = getResourceIdFromValue(media);
        if (!key || seen.has(key)) continue;
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
  readonly onlyResourceIds?: ReadonlySet<string>;
}): void {
  const items = collectWorkflowCanvasMedia(params.nodes);

  for (const item of items) {
    const resourceId = getResourceIdFromValue(item.media);
    if (
      !resourceId ||
      (params.onlyResourceIds && !params.onlyResourceIds.has(resourceId))
    ) {
      continue;
    }

    ingestCanvasMediaInBackground({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      media: item.media,
      nodeType: item.nodeType,
    });
  }
}
