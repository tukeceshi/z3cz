import type { Edge as ReactFlowEdge } from "@xyflow/react";

import type { WorkflowEdgeType } from "./workflow-types";

/** Build `${nodeId}:${handleId}` keys for handles wired on each node. */
export function buildConnectedHandleKeysByNode(
  edges: readonly ReactFlowEdge<WorkflowEdgeType>[]
): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.targetHandle) {
      const set = map.get(edge.target) ?? new Set<string>();
      set.add(`${edge.target}:${edge.targetHandle}`);
      map.set(edge.target, set);
    }
    if (edge.sourceHandle) {
      const set = map.get(edge.source) ?? new Set<string>();
      set.add(`${edge.source}:${edge.sourceHandle}`);
      map.set(edge.source, set);
    }
  }

  const frozen = new Map<string, readonly string[]>();
  for (const [nodeId, keys] of map) {
    frozen.set(nodeId, [...keys]);
  }
  return frozen;
}

export function connectedHandleKeysEqual(
  left: readonly string[] | undefined,
  right: readonly string[]
): boolean {
  if (!left) {
    return right.length === 0;
  }
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}
