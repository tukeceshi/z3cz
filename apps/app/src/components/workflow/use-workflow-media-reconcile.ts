import type { Node as ReactFlowNode } from "@xyflow/react";
import { getResourceIdFromValue } from "@dafthunk/types";
import { useEffect, useMemo, useRef } from "react";

import type { WorkflowNodeType } from "@/components/workflow/workflow-types";
import {
  applyMediaResourceRekeyToNodes,
  reconcileWorkflowMediaReferencesInNodes,
} from "@/services/reconcile-workflow-media-references";
import {
  collectWorkflowCanvasMedia,
  ingestWorkflowCanvasMediaInBackground,
} from "@/services/ingest-canvas-media";
import {
  MEDIA_RESOURCE_REKEYED_EVENT,
  type MediaResourceRekeyedDetail,
} from "@/services/media-resource-rekey-events";

interface UseWorkflowMediaReconcileParams {
  readonly organizationId: string | undefined;
  readonly workflowId: string | undefined;
  readonly graphReady: boolean;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly setNodes: React.Dispatch<
    React.SetStateAction<ReactFlowNode<WorkflowNodeType>[]>
  >;
}

function buildWorkflowMediaFingerprint(
  nodes: readonly ReactFlowNode<WorkflowNodeType>[]
): string {
  const resourceIds = collectWorkflowCanvasMedia(nodes)
    .map((item) => getResourceIdFromValue(item.media))
    .filter((id): id is string => Boolean(id))
    .sort();
  return resourceIds.join("|");
}

export function useWorkflowMediaReconcile({
  organizationId,
  workflowId,
  graphReady,
  nodes,
  setNodes,
}: UseWorkflowMediaReconcileParams): void {
  const ingestedFingerprintRef = useRef<string | null>(null);
  const ingestedResourceIdsRef = useRef<Set<string>>(new Set());
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const mediaFingerprint = useMemo(
    () => buildWorkflowMediaFingerprint(nodes),
    [nodes]
  );

  useEffect(() => {
    ingestedFingerprintRef.current = null;
    ingestedResourceIdsRef.current = new Set();
  }, [organizationId, workflowId]);

  useEffect(() => {
    if (
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

    let cancelled = false;
    const snapshotNodes = nodesRef.current;

    void reconcileWorkflowMediaReferencesInNodes(
      snapshotNodes,
      organizationId,
      workflowId
    ).then((patched) => {
      if (cancelled) {
        return;
      }

      const activeNodes = patched ?? snapshotNodes;
      ingestedFingerprintRef.current =
        buildWorkflowMediaFingerprint(activeNodes);

      if (patched) {
        setNodes(patched);
      }

      const items = collectWorkflowCanvasMedia(activeNodes);
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
          nodes: activeNodes,
          onlyResourceIds: newResourceIds,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    graphReady,
    organizationId,
    workflowId,
    mediaFingerprint,
    setNodes,
  ]);

  useEffect(() => {
    if (!organizationId || !workflowId) {
      return;
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<MediaResourceRekeyedDetail>).detail;
      if (
        !detail ||
        detail.organizationId !== organizationId ||
        detail.workflowId !== workflowId
      ) {
        return;
      }

      setNodes((current) => {
        const patched = applyMediaResourceRekeyToNodes(
          current,
          detail.fromMediaId,
          detail.toMediaReference
        );
        return patched ?? current;
      });
    };

    window.addEventListener(MEDIA_RESOURCE_REKEYED_EVENT, handler);
    return () => window.removeEventListener(MEDIA_RESOURCE_REKEYED_EVENT, handler);
  }, [organizationId, workflowId, setNodes]);
}
