import {
  getMediaReferenceKey,
  isMediaReference,
  type MediaReference,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";

import type { WorkflowNodeType } from "@/components/workflow/workflow-types";

function collectMediaReferencesDeep(
  value: unknown,
  seen: Set<MediaReference>,
  out: MediaReference[]
): void {
  if (isMediaReference(value)) {
    if (![...seen].some((existing) => mediaReferenceKey(existing) === mediaReferenceKey(value))) {
      seen.add(value);
      out.push(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectMediaReferencesDeep(item, seen, out);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const nested of Object.values(value)) {
    collectMediaReferencesDeep(nested, seen, out);
  }
}

function mediaReferenceKey(ref: MediaReference): string {
  return getMediaReferenceKey(ref);
}

/** Walk entire node data (inputs, outputs, history items) for media references. */
export function collectAllWorkflowMediaReferences(
  nodes: readonly ReactFlowNode<WorkflowNodeType>[]
): readonly MediaReference[] {
  const seen = new Set<MediaReference>();
  const out: MediaReference[] = [];

  for (const node of nodes) {
    collectMediaReferencesDeep(node.data, seen, out);
  }

  return out;
}
