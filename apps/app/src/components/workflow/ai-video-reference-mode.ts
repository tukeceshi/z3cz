import {
  AI_VIDEO_NODE_TYPE,
  normalizeVideoModelParameterRules,
  type SubmitAiVideoMediaReferenceCounts,
  type VideoModelParameterRules,
  type VideoReferenceMode,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge } from "@xyflow/react";

import { readNodeGenerationParams } from "./generative-card-params";
import {
  REF_REFERENCE_MODE_META_KEY,
  readVideoReferenceModeFromMetadata,
} from "./generative-reference-metadata";
import { resolveAiVideoReferenceRules } from "./ai-video-reference-policy";
import {
  AI_VIDEO_REFERENCE_HANDLE_ID,
  countAiVideoReferenceCounts,
} from "./ai-video-node-utils";

const referenceModeAutoSwitchNotifiedKeys = new Set<string>();

function buildReferenceModeAutoSwitchNoticeKey(
  nodeId: string,
  counts: SubmitAiVideoMediaReferenceCounts
): string {
  return `${nodeId}:${counts.imageCount}:${counts.videoCount}:${counts.audioCount}`;
}

export function shouldShowReferenceModeAutoSwitchNotice(
  nodeId: string,
  counts: SubmitAiVideoMediaReferenceCounts
): boolean {
  const key = buildReferenceModeAutoSwitchNoticeKey(nodeId, counts);
  if (referenceModeAutoSwitchNotifiedKeys.has(key)) {
    return false;
  }
  referenceModeAutoSwitchNotifiedKeys.add(key);
  return true;
}

export function resetReferenceModeAutoSwitchNoticesForNode(nodeId: string): void {
  const prefix = `${nodeId}:`;
  for (const key of referenceModeAutoSwitchNotifiedKeys) {
    if (key.startsWith(prefix)) {
      referenceModeAutoSwitchNotifiedKeys.delete(key);
    }
  }
}

export function clearReferenceModeAutoSwitchNoticeIfResolved(params: {
  readonly nodeId: string;
  readonly nodeData: WorkflowNodeType;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "sourceHandle" | "targetHandle"
  >[];
  readonly nodes: readonly { readonly id: string; readonly data: WorkflowNodeType }[];
}): void {
  const rules = resolveAiVideoReferenceRules({
    targetNodeData: params.nodeData,
  });
  const normalized = normalizeVideoModelParameterRules(rules);
  const mode = resolveEffectiveVideoReferenceMode(params.nodeData, normalized);
  const counts = countAiVideoReferenceCounts(
    params.nodeId,
    params.edges,
    params.nodes
  );

  if (
    mode === "reference_image" ||
    !shouldAutoSwitchVideoReferenceMode("first_last_frame", counts)
  ) {
    resetReferenceModeAutoSwitchNoticesForNode(params.nodeId);
  }
}
import type { GenerativeReferenceChip } from "./generative-reference-utils";
import { upsertNodeInputValues } from "./workflow-context";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export function resolveEffectiveVideoReferenceMode(
  nodeData: WorkflowNodeType,
  rules: VideoModelParameterRules,
  params?: Readonly<Record<string, unknown>>
): VideoReferenceMode {
  const raw = params?.reference_mode ?? readNodeGenerationParams(nodeData.inputs).reference_mode;
  if (raw === "first_last_frame" || raw === "reference_image") {
    return raw;
  }
  return readVideoReferenceModeFromMetadata(nodeData, rules);
}

export function shouldAutoSwitchVideoReferenceMode(
  mode: VideoReferenceMode,
  counts: SubmitAiVideoMediaReferenceCounts
): boolean {
  if (mode !== "first_last_frame") {
    return false;
  }
  return (
    counts.imageCount > 2 ||
    counts.videoCount > 0 ||
    counts.audioCount > 0
  );
}

export function buildVideoReferenceModeSwitchPatch(
  current: WorkflowNodeType
): Partial<Pick<WorkflowNodeType, "inputs" | "metadata">> {
  const storedParams = readNodeGenerationParams(current.inputs);
  const nextParams = {
    ...storedParams,
    reference_mode: "reference_image" as const,
  };

  return {
    inputs: upsertNodeInputValues(
      current.inputs,
      { params: nextParams },
      { params: "json" }
    ),
    metadata: {
      ...(current.metadata ?? {}),
      [REF_REFERENCE_MODE_META_KEY]: "reference_image",
    },
  };
}

export function syncVideoReferenceModeIfNeeded(params: {
  readonly nodeData: WorkflowNodeType;
  readonly edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "target" | "sourceHandle" | "targetHandle"
  >[];
  readonly nodes: readonly { readonly id: string; readonly data: WorkflowNodeType }[];
  readonly targetNodeId: string;
}): Partial<Pick<WorkflowNodeType, "inputs" | "metadata">> | null {
  const rules = resolveAiVideoReferenceRules({
    targetNodeData: params.nodeData,
  });
  const normalized = normalizeVideoModelParameterRules(rules);
  const storedParams = readNodeGenerationParams(params.nodeData.inputs);
  const mode = resolveEffectiveVideoReferenceMode(
    params.nodeData,
    normalized,
    storedParams
  );
  const counts = countAiVideoReferenceCounts(
    params.targetNodeId,
    params.edges,
    params.nodes
  );

  if (!shouldAutoSwitchVideoReferenceMode(mode, counts)) {
    return null;
  }

  return buildVideoReferenceModeSwitchPatch(params.nodeData);
}

export function annotateVideoReferenceChips(
  chips: readonly GenerativeReferenceChip[],
  mode: VideoReferenceMode,
  counts: SubmitAiVideoMediaReferenceCounts,
  labels: {
    readonly firstFrame: string;
    readonly lastFrame: string;
  }
): readonly GenerativeReferenceChip[] {
  if (mode !== "first_last_frame") {
    return chips;
  }
  if (
    counts.videoCount > 0 ||
    counts.audioCount > 0 ||
    counts.imageCount > 2
  ) {
    return chips;
  }

  let imageIndex = 0;
  return chips.map((chip) => {
    if (chip.kind !== "image") {
      return chip;
    }
    const overlayLabel =
      imageIndex === 0
        ? labels.firstFrame
        : imageIndex === 1
          ? labels.lastFrame
          : undefined;
    imageIndex += 1;
    return overlayLabel ? { ...chip, overlayLabel } : chip;
  });
}

export function isAiVideoMediaReferenceConnection(params: {
  readonly connection: {
    readonly target?: string | null;
    readonly targetHandle?: string | null;
  };
  readonly targetNodeType: string | undefined;
}): boolean {
  return (
    params.targetNodeType === AI_VIDEO_NODE_TYPE &&
    params.connection.targetHandle === AI_VIDEO_REFERENCE_HANDLE_ID &&
    !!params.connection.target
  );
}
