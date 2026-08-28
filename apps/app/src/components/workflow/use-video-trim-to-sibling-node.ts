import { AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import {
  useEdges,
  useNodes,
  useReactFlow,
  type Edge as ReactFlowEdge,
  type Node as ReactFlowNode,
} from "@xyflow/react";
import { useCallback } from "react";
import { useParams } from "react-router";

import { useObjectService } from "@/services/object-service";

import { AI_VIDEO_OUTPUT_ID } from "./ai-video-node-utils";
import {
  buildEmptyAiVideoSiblingNode,
  findAiVideoCatalog,
  resolveTrimSiblingNodeName,
} from "./create-ai-video-node-from-manual-upload";
import {
  appendGenerativeReferenceConnection,
  buildPanelReferenceConnection,
} from "./generative-reference-connection";
import { useWorkflow } from "./workflow-context";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";
import {
  findOpenNodePositionFromSource,
  resolveWorkflowNodeDimensions,
} from "./workflow-node-placement";

export interface CreateTrimSiblingNodeShellResult {
  readonly nodeId: string;
  readonly referenceLinked: boolean;
}

export function useVideoTrimToSiblingNode(sourceNodeId: string) {
  const { nodeTypes = [], disabled, generativeReferenceCatalogs } =
    useWorkflow();
  const nodes = useNodes();
  const edges = useEdges<ReactFlowEdge<WorkflowEdgeType>>();
  const { setNodes, setEdges, getNode, getViewport, setCenter } = useReactFlow();
  const { createObjectUrl } = useObjectService();
  const { id: workflowId } = useParams<{ id: string }>();

  const createTrimSiblingNodeShell =
    useCallback((): CreateTrimSiblingNodeShellResult | null => {
      if (disabled || !workflowId) {
        return null;
      }

      const sourceNode = getNode(sourceNodeId);
      if (!sourceNode) {
        return null;
      }

      const catalog = findAiVideoCatalog(nodeTypes);
      if (!catalog) {
        return null;
      }

      const sourceData = sourceNode.data as WorkflowNodeType;
      const sourceName = sourceData.name?.trim() || catalog.name;
      const typedNodes = nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[];
      const nodeName = resolveTrimSiblingNodeName({
        sourceNodeName: sourceName,
        existingNodes: typedNodes,
      });
      const nodeId = `${AI_VIDEO_NODE_TYPE}-trim-${Date.now()}`;
      const position = findOpenNodePositionFromSource({
        sourceNode,
        targetNodeType: AI_VIDEO_NODE_TYPE,
        existingNodes: typedNodes,
      });

      const newNode = buildEmptyAiVideoSiblingNode({
        catalog,
        nodeId,
        nodeName,
        position,
        createObjectUrl: sourceData.createObjectUrl ?? createObjectUrl,
      });

      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        newNode,
      ]);

      const nextNodes: ReactFlowNode<WorkflowNodeType>[] = [
        ...typedNodes.map((node) => ({ ...node, selected: false })),
        newNode,
      ];

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
      nodeTypes,
      nodes,
      setCenter,
      setEdges,
      setNodes,
      sourceNodeId,
      workflowId,
    ]);

  return { createTrimSiblingNodeShell };
}
