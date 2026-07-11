import type { NodeType } from "@dafthunk/types";
import {
  buildAllowedNodeTypeSet,
  filterNodeTypesByScheme,
} from "@dafthunk/runtime";
import type { WorkflowScheme } from "@dafthunk/types";

export function filterNodeTypesForScheme(
  allNodeTypes: NodeType[],
  scheme: WorkflowScheme
): NodeType[] {
  return filterNodeTypesByScheme(allNodeTypes, scheme.nodeRules);
}

export function getAllowedNodeTypesForScheme(
  allNodeTypes: NodeType[],
  scheme: WorkflowScheme
): Set<string> {
  return buildAllowedNodeTypeSet(allNodeTypes, scheme.nodeRules);
}

export function assertTriggerAllowedByScheme(
  scheme: WorkflowScheme,
  trigger: string
): void {
  if (!scheme.allowedTriggers.includes(trigger as WorkflowScheme["allowedTriggers"][number])) {
    throw new Error(`Trigger "${trigger}" is not allowed in scheme "${scheme.name}"`);
  }
}

export function assertRuntimeAllowedByScheme(
  scheme: WorkflowScheme,
  runtime: string
): void {
  if (!scheme.allowedRuntimes.includes(runtime as WorkflowScheme["allowedRuntimes"][number])) {
    throw new Error(
      `Execution mode "${runtime}" is not allowed in scheme "${scheme.name}"`
    );
  }
}
