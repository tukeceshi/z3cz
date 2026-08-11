import type { MediaReference } from "@dafthunk/types";
import {
  useNodes,
  useReactFlow,
  type Node as ReactFlowNode,
} from "@xyflow/react";
import { useCallback } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useAuth } from "@/components/auth-context";
import { useAppToast } from "@/hooks/use-app-toast";
import { useObjectService } from "@/services/object-service";

import {
  buildSiblingNodeFromHistoryItem,
  findHistoryExpandCatalog,
  type HistoryExpandKind,
} from "./expand-history-to-sibling-node";
import {
  fetchGenerativeHistoryModels,
  useHistoryModelUnavailableToast,
} from "./use-generative-history-models";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

export function useExpandHistoryToSiblingNode(
  sourceNodeId: string,
  kind: HistoryExpandKind
) {
  const { nodeTypes = [], disabled } = useWorkflow();
  const { organization } = useAuth();
  const orgId = organization?.id;
  const nodes = useNodes();
  const { setNodes, getNode } = useReactFlow();
  const { createObjectUrl } = useObjectService();
  const { t } = useTranslation();
  const toast = useAppToast();
  const notifyHistoryModelUnavailable = useHistoryModelUnavailableToast();

  return useCallback(
    (item: {
      readonly media: MediaReference;
      readonly prompt: string;
      readonly params?: Readonly<Record<string, unknown>>;
      readonly platformModelId?: string;
      readonly aiInterfaceId?: string;
      readonly modelDisplayName?: string;
      readonly createdAt: string;
    }) => {
      if (disabled) return;

      void (async () => {
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

        if (!orgId) {
          toast.error("workflow.aiImagePanel.historyExpandFailed");
          return;
        }

        let models;
        try {
          models = await fetchGenerativeHistoryModels(orgId, kind);
        } catch {
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
          aiInterfaceId: item.aiInterfaceId,
          modelDisplayName: item.modelDisplayName,
          createdAt: item.createdAt,
          models,
          existingNodes: typedNodes,
          createObjectUrl,
          t: (key) => t(key as never),
        });

        setNodes((current) => [
          ...current.map((node) => ({ ...node, selected: false })),
          newNode,
        ]);
        notifyHistoryModelUnavailable(
          Boolean(item.platformModelId && item.aiInterfaceId) &&
            !models.some(
              (entry) =>
                entry.selectable &&
                entry.canonicalId === item.platformModelId &&
                entry.interfaceId === item.aiInterfaceId
            )
        );
        toast.success("workflow.aiImagePanel.historyExpandSuccess");
      })();
    },
    [
      createObjectUrl,
      disabled,
      getNode,
      kind,
      nodeTypes,
      nodes,
      notifyHistoryModelUnavailable,
      orgId,
      setNodes,
      sourceNodeId,
      t,
      toast,
    ]
  );
}
