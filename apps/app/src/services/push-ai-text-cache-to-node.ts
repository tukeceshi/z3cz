import type { Node as ReactFlowNode } from "@xyflow/react";
import {
  getResourceIdFromValue,
  isResourceIdReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";

import { isAiTextGenerating, readAiTextResultHistory } from "@/components/workflow/ai-text-node-utils";
import { readAiTextResultReference } from "@/components/workflow/ai-text-persist-utils";
import type { WorkflowNodeType } from "@/components/workflow/workflow-types";
import { loadAiTextBodyFromCache } from "@/services/ai-text-cache-layer";

export interface PushAiTextCacheToDisplayParams {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly reference: WorkflowMediaValue;
  readonly workflowSha?: string;
}

/** Cache hydrates IndexedDB then hangs preview/body for the card. */
export async function pushAiTextCacheToDisplay(
  params: PushAiTextCacheToDisplayParams
): Promise<boolean> {
  const body = await loadAiTextBodyFromCache(params);
  return Boolean(body?.trim());
}

export interface CollectWorkflowAiTextNodeRef {
  readonly nodeId: string;
  readonly reference: WorkflowMediaValue;
  readonly fingerprint: string;
}

export function collectWorkflowAiTextNodeRefs(
  nodes: readonly ReactFlowNode<WorkflowNodeType>[]
): readonly CollectWorkflowAiTextNodeRef[] {
  const refs: CollectWorkflowAiTextNodeRef[] = [];

  for (const node of nodes) {
    if (isAiTextGenerating(node.data.metadata)) {
      continue;
    }

    const reference = readAiTextResultReference(node.data.inputs);
    if (!reference) {
      continue;
    }

    const mediaId = getResourceIdFromValue(reference);
    if (!mediaId) {
      continue;
    }

    const sha = isResourceIdReference(reference)
      ? (reference.contentSha256 ?? "")
      : "";
    const selectedId =
      readAiTextResultHistory(node.data.inputs).selectedId ?? "";

    refs.push({
      nodeId: node.id,
      reference,
      fingerprint: `${mediaId}:${sha}:${selectedId}`,
    });
  }

  return refs;
}

export function pushWorkflowAiTextCacheInBackground(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly onlyFingerprints?: ReadonlySet<string>;
}): void {
  for (const item of collectWorkflowAiTextNodeRefs(params.nodes)) {
    if (
      params.onlyFingerprints &&
      !params.onlyFingerprints.has(item.fingerprint)
    ) {
      continue;
    }

    const workflowSha = isResourceIdReference(item.reference)
      ? item.reference.contentSha256
      : undefined;

    void pushAiTextCacheToDisplay({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      reference: item.reference,
      workflowSha,
    }).catch(() => {
      // Best-effort cache → canvas hang.
    });
  }
}
