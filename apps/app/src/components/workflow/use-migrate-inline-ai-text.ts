import type { Node as ReactFlowNode } from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";

import type { WorkflowNodeType } from "@/components/workflow/workflow-types";

import {
  buildInlineAiTextFingerprint,
  migrateInlineAiTextNodeData,
  nodeHasInlineAiText,
} from "./migrate-inline-ai-text";

interface UseMigrateInlineAiTextParams {
  readonly organizationId: string | undefined;
  readonly workflowId: string | undefined;
  readonly cloudConfigured: boolean;
  readonly graphReady: boolean;
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly setNodes: React.Dispatch<
    React.SetStateAction<ReactFlowNode<WorkflowNodeType>[]>
  >;
}

export function useMigrateInlineAiText({
  organizationId,
  workflowId,
  cloudConfigured,
  graphReady,
  nodes,
  setNodes,
}: UseMigrateInlineAiTextParams): void {
  const migratedFingerprintRef = useRef<string | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const inlineFingerprint = useMemo(
    () => buildInlineAiTextFingerprint(nodes),
    [nodes]
  );

  useEffect(() => {
    migratedFingerprintRef.current = null;
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

    if (migratedFingerprintRef.current === inlineFingerprint) {
      return;
    }

    const snapshotNodes = nodesRef.current;
    const targets = snapshotNodes.filter((node) =>
      nodeHasInlineAiText(node.data)
    );
    if (targets.length === 0) {
      migratedFingerprintRef.current = inlineFingerprint;
      return;
    }

    let cancelled = false;

    void (async () => {
      const patches = new Map<string, WorkflowNodeType>();

      for (const node of targets) {
        const migrated = await migrateInlineAiTextNodeData({
          organizationId,
          workflowId,
          cloudConfigured,
          data: node.data,
        });
        if (migrated) {
          patches.set(node.id, migrated);
        }
      }

      if (cancelled || patches.size === 0) {
        if (!cancelled) {
          migratedFingerprintRef.current = inlineFingerprint;
        }
        return;
      }

      setNodes((current) =>
        current.map((node) => {
          const migrated = patches.get(node.id);
          return migrated ? { ...node, data: migrated } : node;
        })
      );

      migratedFingerprintRef.current = buildInlineAiTextFingerprint(
        snapshotNodes.map((node) => ({
          id: node.id,
          data: patches.get(node.id) ?? node.data,
        }))
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    cloudConfigured,
    graphReady,
    inlineFingerprint,
    organizationId,
    setNodes,
    workflowId,
  ]);
}
