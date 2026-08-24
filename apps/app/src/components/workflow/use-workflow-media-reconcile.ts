import type { Node as ReactFlowNode } from "@xyflow/react";
import { getResourceIdFromValue } from "@dafthunk/types";
import { useEffect, useMemo, useRef } from "react";

import type { WorkflowNodeType } from "@/components/workflow/workflow-types";
import {
  collectWorkflowCanvasMedia,
  ingestWorkflowCanvasMediaInBackground,
} from "@/services/ingest-canvas-media";
import {
  collectWorkflowAiTextNodeRefs,
  patchNodesAiTextStagingState,
  pushWorkflowAiTextCacheInBackground,
} from "@/services/push-ai-text-cache-to-node";

interface UseWorkflowMediaReconcileParams {
  readonly organizationId: string | undefined;
  readonly workflowId: string | undefined;
  readonly graphReady: boolean;
  readonly enabled?: boolean;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly setNodes: React.Dispatch<
    React.SetStateAction<ReactFlowNode<WorkflowNodeType>[]>
  >;
}

function buildWorkflowMediaFingerprint(
  nodes: readonly ReactFlowNode<WorkflowNodeType>[]
): string {
  const keys = new Set<string>();

  for (const item of collectWorkflowCanvasMedia(nodes)) {
    const id = getResourceIdFromValue(item.media);
    if (id) {
      keys.add(`media:${id}`);
    }
  }

  for (const item of collectWorkflowAiTextNodeRefs(nodes)) {
    keys.add(`text:${item.nodeId}:${item.fingerprint}`);
  }

  return [...keys].sort().join("|");
}

export function useWorkflowMediaReconcile({
  organizationId,
  workflowId,
  graphReady,
  enabled = true,
  nodes,
  setNodes,
}: UseWorkflowMediaReconcileParams): void {
  const ingestedFingerprintRef = useRef<string | null>(null);
  const ingestedResourceIdsRef = useRef<Set<string>>(new Set());
  const ingestedTextFingerprintByNodeRef = useRef<Map<string, string>>(
    new Map()
  );
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const mediaFingerprint = useMemo(
    () => buildWorkflowMediaFingerprint(nodes),
    [nodes]
  );

  useEffect(() => {
    ingestedFingerprintRef.current = null;
    ingestedResourceIdsRef.current = new Set();
    ingestedTextFingerprintByNodeRef.current = new Map();
  }, [organizationId, workflowId]);

  useEffect(() => {
    if (
      !enabled ||
      !graphReady ||
      !organizationId ||
      !workflowId ||
      nodesRef.current.length === 0
    ) {
      return;
    }

    if (ingestedFingerprintRef.current === mediaFingerprint) {
      return;
    }

    const snapshotNodes = nodesRef.current;
    const newTextFingerprints = new Set<string>();
    for (const item of collectWorkflowAiTextNodeRefs(snapshotNodes)) {
      if (
        ingestedTextFingerprintByNodeRef.current.get(item.nodeId) ===
        item.fingerprint
      ) {
        continue;
      }
      ingestedTextFingerprintByNodeRef.current.set(
        item.nodeId,
        item.fingerprint
      );
      newTextFingerprints.add(item.fingerprint);
    }

    if (newTextFingerprints.size > 0) {
      pushWorkflowAiTextCacheInBackground({
        organizationId,
        workflowId,
        nodes: snapshotNodes,
        onlyFingerprints: newTextFingerprints,
        applyDisplayState: (nodeId, state) => {
          setNodes((current) =>
            patchNodesAiTextStagingState(current, nodeId, state)
          );
        },
      });
    }

    ingestedFingerprintRef.current = buildWorkflowMediaFingerprint(snapshotNodes);

    const items = collectWorkflowCanvasMedia(snapshotNodes);
    const newResourceIds = new Set<string>();
    for (const item of items) {
      const resourceId = getResourceIdFromValue(item.media);
      if (!resourceId || ingestedResourceIdsRef.current.has(resourceId)) {
        continue;
      }
      ingestedResourceIdsRef.current.add(resourceId);
      newResourceIds.add(resourceId);
    }

    if (newResourceIds.size > 0) {
      ingestWorkflowCanvasMediaInBackground({
        organizationId,
        workflowId,
        nodes: snapshotNodes,
        onlyResourceIds: newResourceIds,
      });
    }
  }, [
    enabled,
    graphReady,
    organizationId,
    workflowId,
    mediaFingerprint,
    setNodes,
  ]);
}
