import type { MediaReference } from "@dafthunk/types";
import {
  useNodes,
  useReactFlow,
  type Node as ReactFlowNode,
} from "@xyflow/react";
import { useCallback } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { useObjectService } from "@/services/object-service";

import {
  buildSiblingNodeFromHistoryItem,
  findHistoryExpandCatalog,
  type HistoryExpandKind,
} from "./expand-history-to-sibling-node";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

export function useExpandHistoryToSiblingNode(
  sourceNodeId: string,
  kind: HistoryExpandKind
) {
  const { nodeTypes = [], disabled } = useWorkflow();
  const nodes = useNodes();
  const { setNodes, getNode } = useReactFlow();
  const { createObjectUrl } = useObjectService();
  const { t } = useTranslation();
  const toast = useAppToast();

  return useCallback(
    (item: {
      readonly media: MediaReference;
      readonly prompt: string;
      readonly params?: Readonly<Record<string, unknown>>;
      readonly platformModelId?: string;
      readonly modelDisplayName?: string;
      readonly createdAt: string;
    }) => {
      if (disabled) return;

      const sourceNode = getNode(sourceNodeId);
      if (!sourceNode) {
        toast.error("workflow.aiImagePanel.historyExpandFailed");
        return;
      }

      const catalog = findHistoryExpandCatalog(nodeTypes, kind);
      if (!catalog) {
        toast.error("workflow.aiImagePanel.historyExpandFailed");
        return;
      }

      const typedNodes =
        nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[];
      const newNode = buildSiblingNodeFromHistoryItem({
        kind,
        catalog,
        sourceNodeName:
          (sourceNode.data as WorkflowNodeType).name?.trim() || catalog.name,
        sourcePosition: sourceNode.position,
        media: item.media,
        prompt: item.prompt,
        params: item.params,
        platformModelId: item.platformModelId,
        modelDisplayName: item.modelDisplayName,
        createdAt: item.createdAt,
        existingNodes: typedNodes,
        createObjectUrl,
        t: (key) => t(key as never),
      });

      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        newNode,
      ]);
      toast.success("workflow.aiImagePanel.historyExpandSuccess");
    },
    [
      createObjectUrl,
      disabled,
      getNode,
      kind,
      nodeTypes,
      nodes,
      setNodes,
      sourceNodeId,
      t,
      toast,
    ]
  );
}
