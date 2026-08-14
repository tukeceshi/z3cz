import type { WorkflowWithMetadata } from "@dafthunk/types";

import { getWorkflow } from "@/services/workflow-service";
import { prefetchNodeTypes } from "@/services/type-service";

function workflowMetadataKey(orgId: string, workflowId: string): string {
  return `${orgId}:${workflowId}`;
}

const workflowMetadataCache = new Map<string, WorkflowWithMetadata>();
const workflowMetadataInflight = new Map<string, Promise<WorkflowWithMetadata>>();

export function prefetchWorkflowEditorSession(
  workflowId: string,
  orgId: string,
  schemeId?: string
): void {
  prefetchWorkflowMetadata(workflowId, orgId);
  prefetchNodeTypes(schemeId);
}

export function prefetchWorkflowMetadata(
  workflowId: string,
  orgId: string
): void {
  const key = workflowMetadataKey(orgId, workflowId);
  if (workflowMetadataCache.has(key) || workflowMetadataInflight.has(key)) {
    return;
  }

  const request = getWorkflow(workflowId, orgId)
    .then((metadata) => {
      workflowMetadataCache.set(key, metadata);
      prefetchNodeTypes(metadata.schemeId);
      return metadata;
    })
    .finally(() => {
      workflowMetadataInflight.delete(key);
    });

  workflowMetadataInflight.set(key, request);
}

export function consumePrefetchedWorkflowMetadata(
  workflowId: string,
  orgId: string
): WorkflowWithMetadata | null {
  return (
    workflowMetadataCache.get(workflowMetadataKey(orgId, workflowId)) ?? null
  );
}

export function clearPrefetchedWorkflowMetadata(
  workflowId: string,
  orgId: string
): void {
  workflowMetadataCache.delete(workflowMetadataKey(orgId, workflowId));
}
