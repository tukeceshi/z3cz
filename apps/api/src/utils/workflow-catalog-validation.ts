import { assertWorkflowExecutableAgainstCatalog } from "@dafthunk/runtime";
import { buildCatalogAllowedNodeTypeSet } from "@dafthunk/types";

import type { Bindings } from "../context";
import { getAllNodeTypes } from "./node-types";

export async function getCatalogNodeTypeSet(
  env: Bindings,
  executionCtx?: ExecutionContext
): Promise<Set<string>> {
  const nodeTypes = await getAllNodeTypes(env, executionCtx);
  return buildCatalogAllowedNodeTypeSet(nodeTypes);
}

export async function validateWorkflowGraphAgainstCatalog(
  env: Bindings,
  workflow: { nodes: { id: string; type: string }[] },
  executionCtx?: ExecutionContext
): Promise<void> {
  if (!workflow.nodes?.length) {
    throw new Error(
      "Cannot execute an empty workflow. Please add nodes to the workflow."
    );
  }

  const allowedNodeTypes = await getCatalogNodeTypeSet(env, executionCtx);
  assertWorkflowExecutableAgainstCatalog(workflow.nodes, allowedNodeTypes);
}
