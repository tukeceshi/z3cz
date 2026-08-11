import type { WorkflowMediaValue } from "@dafthunk/types";
import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  isWorkflowMediaValue,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import { addEdge, type Connection } from "@xyflow/react";

import { readAiAudioCardAudios } from "./ai-audio-node-utils";
import { readAiImageCardPrimaryImage } from "./ai-image-node-utils";
import type { AiTextReferenceKind } from "./ai-text-node-utils";
import { readAiVideoCardPrimaryVideo } from "./ai-video-node-utils";
import {
  classifyAiVideoReferenceFromNodeType,
  type AiVideoReferenceKind,
} from "./ai-video-node-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface GenerativeReferenceChip {
  readonly edgeId: string;
  readonly sourceNodeId: string;
  readonly kind: AiTextReferenceKind;
  readonly label: string;
  readonly textExcerpt?: string;
  readonly media?: WorkflowMediaValue;
  readonly overlayLabel?: string;
}

function firstWorkflowMedia(value: unknown): WorkflowMediaValue | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (isWorkflowMediaValue(entry)) {
        return entry;
      }
    }
    return null;
  }
  return isWorkflowMediaValue(value) ? value : null;
}

export function resolveReferenceMediaFromSource(params: {
  readonly kind: AiTextReferenceKind | AiVideoReferenceKind;
  readonly sourceData: WorkflowNodeType;
  readonly outputValue: unknown;
}): WorkflowMediaValue | undefined {
  if (params.kind === "text") {
    return undefined;
  }

  if (
    params.kind === "image" &&
    params.sourceData.nodeType === AI_IMAGE_NODE_TYPE
  ) {
    return readAiImageCardPrimaryImage(
      params.sourceData.inputs,
      params.sourceData.outputs,
      params.sourceData.metadata
    );
  }

  if (
    params.kind === "video" &&
    params.sourceData.nodeType === AI_VIDEO_NODE_TYPE
  ) {
    return readAiVideoCardPrimaryVideo(
      params.sourceData.inputs,
      params.sourceData.outputs,
      params.sourceData.metadata
    );
  }

  if (
    params.kind === "audio" &&
    params.sourceData.nodeType === AI_AUDIO_NODE_TYPE
  ) {
    return readAiAudioCardAudios(
      params.sourceData.inputs,
      params.sourceData.outputs,
      params.sourceData.metadata
    )[0];
  }

  return firstWorkflowMedia(params.outputValue) ?? undefined;
}

/** Collect reference chips wired into a generative node's reference handle. */
export function collectGenerativeReferenceChips(params: {
  readonly nodeId: string;
  readonly targetHandle: string;
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly classifyKind: (
    nodeType: string | undefined
  ) => AiTextReferenceKind | null;
}): readonly GenerativeReferenceChip[] {
  return params.edges
    .filter(
      (edge) =>
        edge.target === params.nodeId &&
        edge.targetHandle === params.targetHandle
    )
    .flatMap((edge) => {
      const source = params.nodes.find((node) => node.id === edge.source);
      if (!source) return [];

      const sourceData = source.data as WorkflowNodeType;
      const kind = params.classifyKind(sourceData.nodeType);
      if (!kind) return [];

      const output = sourceData.outputs?.find(
        (entry) => entry.id === edge.sourceHandle
      );

      let textExcerpt: string | undefined;
      let media: WorkflowMediaValue | undefined;

      if (kind === "text") {
        const fromOutput =
          typeof output?.value === "string" ? output.value : undefined;
        const fromResult = sourceData.inputs?.find(
          (entry) => entry.id === "result"
        )?.value;
        const text =
          fromOutput ??
          (typeof fromResult === "string" ? fromResult : undefined);
        textExcerpt = text?.trim() || undefined;
      } else {
        media = resolveReferenceMediaFromSource({
          kind,
          sourceData,
          outputValue: output?.value,
        });
      }

      return [
        {
          edgeId: edge.id,
          sourceNodeId: edge.source,
          kind,
          label: sourceData.name || edge.source,
          textExcerpt,
          media,
        },
      ];
    });
}

/** Collect image media references wired to a generative reference handle. */
export function collectImageReferenceMedia(params: {
  readonly nodeId: string;
  readonly targetHandle: string;
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly classifyKind: (
    nodeType: string | undefined
  ) => AiTextReferenceKind | null;
}): readonly WorkflowMediaValue[] {
  return collectGenerativeReferenceMedia({
    ...params,
    classifyKind: (nodeType) => {
      const kind = params.classifyKind(nodeType);
      return kind === "image" ? "image" : null;
    },
  });
}

/** Collect image / video / audio media references wired to a reference handle. */
export function collectGenerativeReferenceMedia(params: {
  readonly nodeId: string;
  readonly targetHandle: string;
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly classifyKind?: (
    nodeType: string | undefined
  ) => AiVideoReferenceKind | null;
}): readonly WorkflowMediaValue[] {
  return params.edges
    .filter(
      (edge) =>
        edge.target === params.nodeId &&
        edge.targetHandle === params.targetHandle
    )
    .flatMap((edge) => {
      const source = params.nodes.find((node) => node.id === edge.source);
      if (!source) return [];

      const sourceData = source.data as WorkflowNodeType;
      const kind =
        params.classifyKind?.(sourceData.nodeType) ??
        classifyAiVideoReferenceFromNodeType(sourceData.nodeType);
      if (!kind) return [];

      const output = sourceData.outputs?.find(
        (entry) => entry.id === edge.sourceHandle
      );
      const media = resolveReferenceMediaFromSource({
        kind,
        sourceData,
        outputValue: output?.value,
      });
      return media ? [media] : [];
    });
}

export interface GenerativeReferenceConnectionRef {
  readonly source: string;
  readonly sourceHandle?: string | null;
  readonly target: string;
  readonly targetHandle: string;
}

export function isGenerativeReferenceAlreadyConnected(
  edges: readonly Pick<
    ReactFlowEdge<WorkflowEdgeType>,
    "source" | "sourceHandle" | "target" | "targetHandle"
  >[],
  connection: GenerativeReferenceConnectionRef
): boolean {
  return edges.some((edge) => {
    if (edge.source !== connection.source) return false;
    if (edge.target !== connection.target) return false;
    if (edge.targetHandle !== connection.targetHandle) return false;
    if (
      connection.sourceHandle !== undefined &&
      connection.sourceHandle !== null &&
      edge.sourceHandle !== connection.sourceHandle
    ) {
      return false;
    }
    return true;
  });
}

export type StudioReferenceDropPreview =
  | "valid"
  | "already_connected"
  | "rejected";

export function studioReferenceDropPreviewFromVerdict(verdict: {
  readonly ok: boolean;
  readonly reason?: string;
}): StudioReferenceDropPreview {
  if (verdict.ok) return "valid";
  if (verdict.reason === "already_connected") return "already_connected";
  return "rejected";
}

export function connectGenerativeReferenceEdge(
  setEdges: (updater: (edges: ReactFlowEdge[]) => ReactFlowEdge[]) => void,
  connection: Connection
): void {
  setEdges((current) =>
    addEdge(
      {
        ...connection,
        id: `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}-${Date.now()}`,
        type: "workflowEdge",
        data: {
          isValid: true,
          isActive: false,
          sourceType: connection.sourceHandle ?? undefined,
          targetType: connection.targetHandle ?? undefined,
        },
        zIndex: 0,
      },
      current
    )
  );
}
