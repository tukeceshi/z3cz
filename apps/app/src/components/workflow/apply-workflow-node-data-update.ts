import type { Node as ReactFlowNode } from "@xyflow/react";

import type { WorkflowNodeType } from "./workflow-types";

export type WorkflowNodeDataUpdate =
  | Partial<WorkflowNodeType>
  | ((current: WorkflowNodeType) => Partial<WorkflowNodeType>);

export function applyWorkflowNodeDataUpdate<
  TNode extends Pick<ReactFlowNode<WorkflowNodeType>, "id" | "data">,
>(
  nodes: readonly TNode[],
  nodeId: string,
  dataOrFn: WorkflowNodeDataUpdate
): TNode[] {
  return nodes.map((node) => {
    if (node.id !== nodeId) {
      return node;
    }
    const update =
      typeof dataOrFn === "function" ? dataOrFn(node.data) : dataOrFn;
    return {
      ...node,
      data: {
        ...node.data,
        ...update,
      },
    };
  });
}
