import type { Bindings } from "../context";
import { getAllNodeTypes } from "./node-types";

export {
  assertWorkflowExecutableAgainstCatalog,
  buildCatalogAllowedNodeTypeSet,
  detectCycles,
  type ValidationError,
  validateTypeCompatibility,
  validateWorkflow,
} from "@dafthunk/runtime";

export {
  getCatalogNodeTypeSet,
  validateWorkflowGraphAgainstCatalog,
} from "./workflow-catalog-validation";

/**
 * Validates that a workflow has nodes before execution
 * @throws Error if workflow is empty or has no nodes
 */
export function validateWorkflowForExecution(workflow: {
  nodes?: { type: string }[];
}): void {
  if (!workflow.nodes || workflow.nodes.length === 0) {
    throw new Error(
      "Cannot execute an empty workflow. Please add nodes to the workflow."
    );
  }
}

/** @deprecated Prefer validateWorkflowGraphAgainstCatalog */
export async function validateWorkflowCatalogForExecution(
  env: Bindings,
  workflow: { nodes: { id: string; type: string }[] },
  executionCtx?: ExecutionContext
): Promise<void> {
  await validateWorkflowGraphAgainstCatalog(env, workflow, executionCtx);
}