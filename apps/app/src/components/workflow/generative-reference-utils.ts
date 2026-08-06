import type { MediaReference, ObjectReference } from "@dafthunk/types";
import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  isMediaReference,
} from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import { addEdge, type Connection } from "@xyflow/react";

import { readAiAudioCardAudios } from "./ai-audio-node-utils";
import { readAiImageCardImages } from "./ai-image-node-utils";
import type { AiTextReferenceKind } from "./ai-text-node-utils";
import { readAiVideoCardVideos } from "./ai-video-node-utils";
import {
  classifyAiVideoReferenceFromNodeType,
  type AiVideoReferenceKind,
} from "./ai-video-node-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface GenerativeReferenceChip {
  readonly edgeId: string;
  readonly kind: AiTextReferenceKind;
  readonly label: string;
  readonly previewUrl?: string;
  readonly textExcerpt?: string;
  readonly media?: MediaReference;
  readonly overlayLabel?: string;
}

function firstMediaReference(value: unknown): MediaReference | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (isMediaReference(entry)) {
        return entry;
      }
    }
    return null;
  }
  return isMediaReference(value) ? value : null;
}

export function resolveReferenceMediaFromSource(params: {
  readonly kind: AiTextReferenceKind | AiVideoReferenceKind;
  readonly sourceData: WorkflowNodeType;
  readonly outputValue: unknown;
}): MediaReference | undefined {
  if (params.kind === "text") {
    return undefined;
  }

  if (
    params.kind === "image" &&
    params.sourceData.nodeType === AI_IMAGE_NODE_TYPE
  ) {
    return readAiImageCardImages(
      params.sourceData.inputs,
      params.sourceData.outputs,
      params.sourceData.metadata
    )[0];
  }

  if (
    params.kind === "video" &&
    params.sourceData.nodeType === AI_VIDEO_NODE_TYPE
  ) {
    return readAiVideoCardVideos(
      params.sourceData.inputs,
      params.sourceData.outputs,
      params.sourceData.metadata
    )[0];
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

  return firstMediaReference(params.outputValue) ?? undefined;
}

function resolveChipPreviewUrl(params: {
  readonly kind: AiTextReferenceKind;
  readonly sourceData: WorkflowNodeType;
  readonly outputValue: unknown;
  readonly createObjectUrl?: (objectReference: ObjectReference) => string;
  readonly resolveMediaPreviewUrl?: (media: MediaReference) => string | null;
}): string | undefined {
  if (params.kind === "text") {
    return undefined;
  }

  const media = resolveReferenceMediaFromSource({
    kind: params.kind,
    sourceData: params.sourceData,
    outputValue: params.outputValue,
  });

  if (!media) {
    return undefined;
  }

  if (params.resolveMediaPreviewUrl) {
    return params.resolveMediaPreviewUrl(media) ?? undefined;
  }

  if ("id" in media && params.createObjectUrl) {
    return params.createObjectUrl(media);
  }

  return undefined;
}

/** Collect reference chips wired into a generative node's reference handle. */
export function collectGenerativeReferenceChips(params: {
  readonly nodeId: string;
  readonly targetHandle: string;
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly createObjectUrl?: (objectReference: ObjectReference) => string;
  readonly resolveMediaPreviewUrl?: (media: MediaReference) => string | null;
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

      let previewUrl: string | undefined;
      let textExcerpt: string | undefined;
      let media: MediaReference | undefined;

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
        previewUrl = resolveChipPreviewUrl({
          kind,
          sourceData,
          outputValue: output?.value,
          createObjectUrl: params.createObjectUrl,
          resolveMediaPreviewUrl: params.resolveMediaPreviewUrl,
        });
      }

      return [
        {
          edgeId: edge.id,
          kind,
          label: sourceData.name || edge.source,
          previewUrl,
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
}): readonly MediaReference[] {
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
}): readonly MediaReference[] {
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
