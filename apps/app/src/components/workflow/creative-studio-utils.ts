import type { Node as ReactFlowNode } from "@xyflow/react";

import { resolveGenerativeNodeDefaultBaseName } from "./generative-node-naming";
import type { WorkflowNodeType } from "./workflow-types";

/** Single source of truth: stored `data.name` (empty → localized type fallback). */
export function resolveStudioNodeLabel(
  node: ReactFlowNode<WorkflowNodeType>,
  t: (key: string) => string
): string {
  const storedName = node.data.name?.trim();
  if (storedName) {
    return storedName;
  }

  const nodeType = node.data.nodeType ?? "";
  return resolveGenerativeNodeDefaultBaseName(nodeType, nodeType || "node", t);
}

export function getStudioInputString(
  data: WorkflowNodeType,
  id: string
): string {
  const value = data.inputs.find((input) => input.id === id)?.value;
  return typeof value === "string" ? value : "";
}
