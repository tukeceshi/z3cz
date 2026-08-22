import type {
  Edge as WorkflowBackendEdge,
  Node as WorkflowBackendNode,
  ObjectReference,
} from "@dafthunk/types";
import type { Edge, Node } from "@xyflow/react";

import {
  buildWorkflowPayload,
  type WorkflowCanvasJson,
} from "@/components/workflow/build-workflow-payload";
import type { NodeType, WorkflowEdgeType, WorkflowNodeType } from "@/components/workflow/workflow-types";
import { adaptBackendNodesToReactFlowNodes } from "@/utils/utils";

export type { WorkflowCanvasJson };

export function captureCanvasJson(
  nodes: Node<WorkflowNodeType>[],
  edges: Edge<WorkflowEdgeType>[]
): WorkflowCanvasJson {
  return buildWorkflowPayload(nodes, edges);
}

export function canvasJsonEquals(
  a: WorkflowCanvasJson,
  b: WorkflowCanvasJson
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function backendEdgesToReactFlow(
  backendEdges: readonly WorkflowBackendEdge[]
): Edge<WorkflowEdgeType>[] {
  return backendEdges.map((edge) => ({
    id: `${edge.source}:${edge.sourceOutput}-${edge.target}:${edge.targetInput}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceOutput,
    targetHandle: edge.targetInput,
    type: "workflowEdge" as const,
    data: {
      isValid: true,
      sourceType: edge.sourceOutput,
      targetType: edge.targetInput,
    },
  }));
}

/** Node ids present in `current` but absent from `target` snapshot. */
export function computeRemovedNodeIds(
  currentNodes: readonly Node<WorkflowNodeType>[],
  targetSnapshot: WorkflowCanvasJson
): string[] {
  const targetIds = new Set(targetSnapshot.nodes.map((node) => node.id));
  return currentNodes
    .filter((node) => !targetIds.has(node.id))
    .map((node) => node.id);
}

/**
 * Apply a canvas JSON snapshot.
 * Existing nodes keep live data (generative content); re-added nodes restore from snapshot.
 */
export function restoreCanvasJson(params: {
  readonly snapshot: WorkflowCanvasJson;
  readonly currentNodes: readonly Node<WorkflowNodeType>[];
  readonly nodeTypes: readonly NodeType[];
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
}): {
  nodes: Node<WorkflowNodeType>[];
  edges: Edge<WorkflowEdgeType>[];
} {
  const { snapshot, currentNodes, nodeTypes, createObjectUrl } = params;
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));
  const adapted = adaptBackendNodesToReactFlowNodes(snapshot.nodes, [
    ...nodeTypes,
  ]);

  const nodes = adapted.map((node) => {
    const existing = currentById.get(node.id);
    if (existing) {
      return {
        ...existing,
        position: node.position,
        selected: false,
        dragging: false,
      };
    }

    return {
      ...node,
      selected: false,
      dragging: false,
      data: {
        ...node.data,
        createObjectUrl,
        nodeTypes: [...nodeTypes],
      },
    };
  });

  const edges = backendEdgesToReactFlow(snapshot.edges);

  return { nodes, edges };
}
