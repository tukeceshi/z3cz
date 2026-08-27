import {
  AI_VIDEO_NODE_TYPE,
  getResourceIdFromValue,
  inferVideoEnhanceResolutionTier,
  isAiVideoEnhancePanel,
  isCloudStoredResource,
  isResourceIdReference,
  parseVideoEnhanceSourceTierFromLabel,
  VIDEO_ENHANCE_DEFAULT_SOURCE_TIER,
  type MediaReference,
  type VolcanoMediaKitPricingResolution,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import {
  getCachedMediaNaturalSize,
  readCachedMediaBlobByMediaId,
} from "@/services/ai-media-cache-service";
import { readVideoNaturalSize } from "@/services/read-video-natural-size";

import {
  AI_VIDEO_REFERENCE_HANDLE_ID,
  classifyAiVideoReferenceFromNodeType,
  readAiVideoCardDisplay,
  readAiVideoResultHistory,
} from "./ai-video-node-utils";
import { collectGenerativeReferenceChips } from "./generative-reference-utils";
import { readHistoryResolutionLabel } from "./generative-history-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface VideoEnhanceSourceGraphContext {
  readonly nodeId: string;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "id" | "source" | "target" | "targetHandle"
  >[];
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}

export function readVideoEnhanceCoverCandidate(
  data: WorkflowNodeType
): MediaReference | null {
  const display = readAiVideoCardDisplay(data.inputs, data.outputs, data.metadata);
  const cover = display.coverMedia[0];
  if (!cover || !isResourceIdReference(cover)) {
    return null;
  }
  return cover;
}

/** Cover already in org cloud storage. */
export function readCloudVideoCoverResource(
  data: WorkflowNodeType
): MediaReference | null {
  const cover = readVideoEnhanceCoverCandidate(data);
  if (!cover || !isCloudStoredResource(cover)) {
    return null;
  }
  return cover;
}

export async function isVideoEnhanceCoverReady(params: {
  readonly cover: MediaReference;
  readonly organizationId: string;
  readonly workflowId: string;
}): Promise<boolean> {
  if (isCloudStoredResource(params.cover)) {
    return true;
  }
  const mediaId = getResourceIdFromValue(params.cover);
  if (!mediaId) {
    return false;
  }
  const cachedSize = await getCachedMediaNaturalSize({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    mediaId,
  });
  if (cachedSize) {
    return true;
  }
  const cachedBlob = await readCachedMediaBlobByMediaId(mediaId);
  return cachedBlob !== null;
}

export function readManualVideoReferences(
  data: WorkflowNodeType
): readonly WorkflowMediaValue[] {
  const value = data.inputs.find((input) => input.id === "manual_videos")?.value;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is WorkflowMediaValue =>
      entry !== null && typeof entry === "object"
  );
}

export function readConnectedVideoEnhanceSource(
  graph: VideoEnhanceSourceGraphContext
): WorkflowMediaValue | null {
  const chips = collectGenerativeReferenceChips({
    nodeId: graph.nodeId,
    targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
    edges: graph.edges,
    nodes: graph.nodes,
    classifyKind: (nodeType) => classifyAiVideoReferenceFromNodeType(nodeType),
  });

  for (const chip of chips) {
    if (chip.kind === "video" && chip.media) {
      return chip.media;
    }
  }

  return null;
}

export function readVideoEnhanceSourceResourceId(
  data: WorkflowNodeType,
  graph?: VideoEnhanceSourceGraphContext
): string | null {
  if (graph) {
    const connected = readConnectedVideoEnhanceSource(graph);
    if (connected) {
      return getResourceIdFromValue(connected);
    }
  }

  const manual = readManualVideoReferences(data)[0];
  if (manual) {
    return getResourceIdFromValue(manual);
  }

  return null;
}

export function readVideoEnhanceSourceTierFromNode(
  data: WorkflowNodeType
): VolcanoMediaKitPricingResolution | null {
  const history = readAiVideoResultHistory(data.inputs);
  const selected = history.selectedId
    ? history.items.find((item) => item.id === history.selectedId)
    : history.items[0];
  if (!selected?.params) {
    return null;
  }
  const label = readHistoryResolutionLabel(selected.params);
  return parseVideoEnhanceSourceTierFromLabel(label);
}

export async function resolveVideoEnhanceSourceTierFromCache(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly mediaId: string;
}): Promise<VolcanoMediaKitPricingResolution | null> {
  const fromMeta = await getCachedMediaNaturalSize(params);
  if (fromMeta) {
    return inferVideoEnhanceResolutionTier(fromMeta.width, fromMeta.height);
  }

  const cachedBlob = await readCachedMediaBlobByMediaId(params.mediaId);
  if (!cachedBlob) {
    return null;
  }

  const naturalSize = await readVideoNaturalSize(cachedBlob.blob);
  if (!naturalSize) {
    return null;
  }
  return inferVideoEnhanceResolutionTier(naturalSize.width, naturalSize.height);
}

export function resolveVideoEnhanceSourceTier(
  tierFromNode: VolcanoMediaKitPricingResolution | null
): VolcanoMediaKitPricingResolution {
  return tierFromNode ?? VIDEO_ENHANCE_DEFAULT_SOURCE_TIER;
}

export function isAiVideoEnhanceNode(
  data: WorkflowNodeType
): boolean {
  return (
    data.nodeType === AI_VIDEO_NODE_TYPE && isAiVideoEnhancePanel(data.metadata)
  );
}
