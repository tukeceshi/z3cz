import type { ObjectReference } from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import { addEdge, type Connection } from "@xyflow/react";

import type { AiTextReferenceKind } from "./ai-text-node-utils";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

export interface GenerativeReferenceChip {
  readonly edgeId: string;
  readonly kind: AiTextReferenceKind;
  readonly label: string;
  readonly previewUrl?: string;
  readonly textExcerpt?: string;
}

function firstObjectReference(value: unknown): ObjectReference | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === "object" && "id" in first) {
      return first as ObjectReference;
    }
    return null;
  }
  if ("id" in value) return value as ObjectReference;
  return null;
}

/** Collect reference chips wired into a generative node's reference handle. */
export function collectGenerativeReferenceChips(params: {
  readonly nodeId: string;
  readonly targetHandle: string;
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly createObjectUrl?: (objectReference: ObjectReference) => string;
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
        const ref = firstObjectReference(output?.value);
        if (ref && params.createObjectUrl) {
          previewUrl = params.createObjectUrl(ref);
        }
      }

      return [
        {
          edgeId: edge.id,
          kind,
          label: sourceData.name || edge.source,
          previewUrl,
          textExcerpt,
        },
      ];
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
