import type { Connection, Node as ReactFlowNode } from "@xyflow/react";

import { buildGenerativeReferenceConnectionFromCardDrop } from "./generative-reference-connection";
import type { WorkflowNodeType } from "./workflow-types";

export interface AddNodeConnectionDragHandle {
  readonly type: string;
  readonly id?: string | null;
}

/** Build a reference edge from an existing source output handle to a newly created target node. */
export function buildReferenceConnectionToNewNode(params: {
  readonly dragFromNodeId: string;
  readonly dragFromHandle: AddNodeConnectionDragHandle | null;
  readonly targetNodeId: string;
  readonly nodes: readonly Pick<
    ReactFlowNode<WorkflowNodeType>,
    "id" | "data"
  >[];
}): Connection | null {
  if (!params.dragFromHandle || params.dragFromHandle.type !== "source") {
    return null;
  }

  return buildGenerativeReferenceConnectionFromCardDrop({
    dragFromNodeId: params.dragFromNodeId,
    dragFromHandle: params.dragFromHandle,
    hoveredNodeId: params.targetNodeId,
    nodes: params.nodes,
  });
}
