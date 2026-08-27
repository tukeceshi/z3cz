import {
  AI_VIDEO_NODE_TYPE,
  buildVideoEnhanceOrgModelOption,
  withAiVideoPanelKind,
  withVideoEnhanceNodeConfig,
  withVideoEnhancePendingAutoSubmit,
  type VideoEnhanceNodeConfig,
} from "@dafthunk/types";
import {
  useEdges,
  useNodes,
  useReactFlow,
  type Edge as ReactFlowEdge,
  type Node as ReactFlowNode,
} from "@xyflow/react";
import { useCallback } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useOrgVolcanoMediaKitConfig } from "@/hooks/use-volcano-mediakit-config";
import { useObjectService } from "@/services/object-service";

import {
  applyModelBindingToNodeData,
  generativeModelBindingHandlersForModality,
} from "./generative-model-binding";
import {
  appendGenerativeReferenceConnection,
  buildPanelReferenceConnection,
} from "./generative-reference-connection";
import { useWorkflow } from "./workflow-context";
import type { NodeType, WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";
import {
  AI_VIDEO_OUTPUT_ID,
  mergeAiVideoNodeCatalogInputs,
} from "./ai-video-node-utils";
import { mergeAiTextNodeCatalogInputs } from "./ai-text-node-utils";
import { findOpenNodePositionFromSource, resolveWorkflowNodeDimensions } from "./workflow-node-placement";

export interface CreateEnhanceSiblingNodeResult {
  readonly nodeId: string;
  readonly referenceLinked: boolean;
}

function resolveEnhanceNodeName(
  sourceName: string,
  existingNodes: ReadonlyArray<{ readonly data: { readonly name?: string } }>
): string {
  const base = `${sourceName}-画质增强`;
  const existing = new Set(
    existingNodes
      .map((node) => node.data.name?.trim())
      .filter((name): name is string => Boolean(name))
  );
  if (!existing.has(base)) {
    return base;
  }
  let index = 2;
  while (existing.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

export function useVideoEnhanceToSiblingNode(sourceNodeId: string) {
  const { nodeTypes = [], disabled, generativeReferenceCatalogs } =
    useWorkflow();
  const nodes = useNodes();
  const edges = useEdges<ReactFlowEdge<WorkflowEdgeType>>();
  const { setNodes, setEdges, getNode, getViewport, setCenter } = useReactFlow();
  const { createObjectUrl } = useObjectService();
  const { id: workflowId } = useParams<{ id: string }>();
  const { organization } = useAuth();
  const orgId = organization?.id;
  const { interfaceId: mediaKitInterfaceId, config: mediaKitConfig } =
    useOrgVolcanoMediaKitConfig(orgId);

  const createEnhanceSiblingNode = useCallback(
    (config: VideoEnhanceNodeConfig): CreateEnhanceSiblingNodeResult | null => {
      if (
        disabled ||
        !workflowId ||
        !mediaKitInterfaceId ||
        !mediaKitConfig?.active ||
        !mediaKitConfig.hasApiKey
      ) {
        return null;
      }

      const virtualModel = buildVideoEnhanceOrgModelOption({
        interfaceId: mediaKitInterfaceId,
        enabledModes: mediaKitConfig.enabledVideoModes,
      });
      if (!virtualModel) {
        return null;
      }

      const sourceNode = getNode(sourceNodeId);
      if (!sourceNode) {
        return null;
      }

      const catalog = nodeTypes.find(
        (entry): entry is NodeType => entry.type === AI_VIDEO_NODE_TYPE
      );
      if (!catalog) {
        return null;
      }

      const sourceData = sourceNode.data as WorkflowNodeType;
      const sourceName = sourceData.name?.trim() || catalog.name;
      const typedNodes = nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[];
      const nodeName = resolveEnhanceNodeName(sourceName, typedNodes);
      const nodeId = `${AI_VIDEO_NODE_TYPE}-enhance-${Date.now()}`;
      const position = findOpenNodePositionFromSource({
        sourceNode,
        targetNodeType: AI_VIDEO_NODE_TYPE,
        existingNodes: typedNodes,
      });

      const catalogInputs = mergeAiVideoNodeCatalogInputs(
        catalog.type,
        mergeAiTextNodeCatalogInputs(
          catalog.type,
          catalog.inputs.map((input) => ({ ...input, id: input.name })),
          catalog
        ),
        catalog
      );

      const baseData: WorkflowNodeType = {
        name: nodeName,
        nodeType: catalog.type,
        icon: catalog.icon,
        inputs: catalogInputs,
        outputs: catalog.outputs.map((output) => ({ ...output, id: output.name })),
        executionState: "idle",
        createObjectUrl: sourceData.createObjectUrl,
        metadata: withAiVideoPanelKind(undefined, "enhance"),
      };

      const bindingPatch = applyModelBindingToNodeData({
        model: virtualModel,
        current: baseData,
        modality: "video",
        updateWorkflowDefault: false,
        handlers: generativeModelBindingHandlersForModality("video"),
      });

      const metadata = withVideoEnhancePendingAutoSubmit(
        withVideoEnhanceNodeConfig(
          bindingPatch.metadata ?? baseData.metadata ?? {},
          config
        )
      );

      const newNode: ReactFlowNode<WorkflowNodeType> = {
        id: nodeId,
        type: "workflowNode",
        position,
        selected: true,
        data: {
          ...baseData,
          ...bindingPatch,
          metadata,
        },
      };

      const nextNodes: ReactFlowNode<WorkflowNodeType>[] = [
        ...typedNodes.map((node) => ({ ...node, selected: false })),
        newNode,
      ];
      setNodes(nextNodes);

      const nodeRefs = nextNodes.map((node) => ({
        id: node.id,
        data: node.data,
      }));
      const connection = buildPanelReferenceConnection({
        sourceNodeId,
        sourceHandle: AI_VIDEO_OUTPUT_ID,
        targetNodeId: nodeId,
        nodes: nodeRefs,
      });

      const referenceLinked = connection
        ? appendGenerativeReferenceConnection({
            connection,
            nodes: nextNodes,
            edges,
            setEdges,
            createObjectUrl,
            generativeReferenceCatalogs,
            disabled,
          })
        : false;

      const { width, height } = resolveWorkflowNodeDimensions(AI_VIDEO_NODE_TYPE);
      const centerX = position.x + width / 2;
      const centerY = position.y + height / 2;
      const { zoom } = getViewport();
      setCenter(centerX, centerY, { zoom, duration: 200 });

      return { nodeId, referenceLinked };
    }, [
      createObjectUrl,
      disabled,
      edges,
      generativeReferenceCatalogs,
      getNode,
      getViewport,
      mediaKitConfig,
      mediaKitInterfaceId,
      nodeTypes,
      nodes,
      setCenter,
      setEdges,
      setNodes,
      sourceNodeId,
      workflowId,
    ]);

  return {
    createEnhanceSiblingNode,
  };
}
