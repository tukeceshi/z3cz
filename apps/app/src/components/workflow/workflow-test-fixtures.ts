import type { WorkflowNodeType, WorkflowParameter } from "./workflow-types";

export function testWorkflowParam(
  partial: { readonly id: string } & Record<string, unknown>
): WorkflowParameter {
  const name = typeof partial.name === "string" ? partial.name : partial.id;
  return {
    name,
    type: "string",
    ...partial,
  } as unknown as WorkflowParameter;
}

export function testWorkflowNodeData(
  partial: Partial<WorkflowNodeType> = {}
): WorkflowNodeType {
  return {
    name: partial.name ?? partial.nodeType ?? "node",
    inputs: [],
    outputs: [],
    executionState: "idle",
    ...partial,
  };
}
