import type { MediaReference } from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { useEffect, useRef } from "react";

import type { WorkflowNodeType } from "@/components/workflow/workflow-types";
import {
  applyMediaResourceRekeyToNodes,
  reconcileWorkflowMediaReferencesInNodes,
} from "@/services/reconcile-workflow-media-references";
import { ingestWorkflowCanvasMediaInBackground } from "@/services/ingest-canvas-media";
import { syncWorkflowMediaResourcesToCatalog } from "@/services/sync-workflow-media-catalog";
import {
  MEDIA_RESOURCE_REKEYED_EVENT,
  type MediaResourceRekeyedDetail,
} from "@/services/media-resource-rekey-events";

interface UseWorkflowMediaReconcileParams {
  readonly organizationId: string | undefined;
  readonly workflowId: string | undefined;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly setNodes: React.Dispatch<
    React.SetStateAction<ReactFlowNode<WorkflowNodeType>[]>
  >;
}

export function useWorkflowMediaReconcile({
  organizationId,
  workflowId,
  nodes,
  setNodes,
}: UseWorkflowMediaReconcileParams): void {
  const reconciledForRef = useRef<string | null>(null);

  useEffect(() => {
    reconciledForRef.current = null;
  }, [organizationId, workflowId]);

  useEffect(() => {
    if (!organizationId || !workflowId || nodes.length === 0) {
      return;
    }

    const reconcileKey = `${organizationId}:${workflowId}`;
    if (reconciledForRef.current === reconcileKey) {
      return;
    }
    reconciledForRef.current = reconcileKey;

    let cancelled = false;

    void reconcileWorkflowMediaReferencesInNodes(
      nodes,
      organizationId,
      workflowId
    ).then((patched) => {
      if (cancelled) {
        return;
      }
      if (patched) {
        setNodes(patched);
      }
      const activeNodes = patched ?? nodes;
      syncWorkflowMediaResourcesToCatalog({
        organizationId,
        nodes: activeNodes,
      });
      ingestWorkflowCanvasMediaInBackground({
        organizationId,
        workflowId,
        nodes: activeNodes,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [organizationId, workflowId, nodes.length, nodes, setNodes]);

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
          detail.toMediaReference as MediaReference
        );
        return patched ?? current;
      });
    };

    window.addEventListener(MEDIA_RESOURCE_REKEYED_EVENT, handler);
    return () => window.removeEventListener(MEDIA_RESOURCE_REKEYED_EVENT, handler);
  }, [organizationId, workflowId, setNodes]);
}
