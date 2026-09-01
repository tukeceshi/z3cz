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
import { useAppToast } from "@/hooks/use-app-toast";

import {
  AI_VIDEO_OUTPUT_ID,
} from "./ai-video-node-utils";
import { withAiVideoRetakeDraft } from "./ai-video-retake-node-utils";
import {
  buildEmptyAiVideoSiblingNode,
  buildLockedRetakeCopyNode,
  findAiVideoCatalog,
  resolveRetakeSiblingNodeName,
  resolveTrimSiblingNodeName,
  type AiVideoSiblingBusyKind,
} from "./create-ai-video-node-from-manual-upload";
import {
  appendGenerativeReferenceConnection,
  buildPanelReferenceConnection,
} from "./generative-reference-connection";
import { prepareWorkflowConnectionAppend } from "./workflow-connection-commit";
import { useWorkflow } from "./workflow-context";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";
import {
  findOpenNodePositionFromSource,
  resolveWorkflowNodeDimensions,
} from "./workflow-node-placement";

export interface CreateAiVideoSiblingNodeShellResult {
  readonly nodeId: string;
  readonly referenceLinked: boolean;
}

export type CreateTrimSiblingNodeShellResult = CreateAiVideoSiblingNodeShellResult;

interface CreateAiVideoSiblingNodeShellParams {
  readonly kind: "trim" | "retake";
  readonly initialBusy?: AiVideoSiblingBusyKind;
}

function useCreateAiVideoSiblingNode(sourceNodeId: string) {
  const { nodeTypes = [], disabled, generativeReferenceCatalogs } =
    useWorkflow();
  const nodes = useNodes();
  const edges = useEdges<ReactFlowEdge<WorkflowEdgeType>>();
  const { setNodes, setEdges, getNode, getViewport, setCenter } = useReactFlow();
  const { createObjectUrl } = useObjectService();
  const { id: workflowId } = useParams<{ id: string }>();

  const createSiblingNodeShell = useCallback(
    (
      params: CreateAiVideoSiblingNodeShellParams
    ): CreateAiVideoSiblingNodeShellResult | null => {
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
      const nodeName =
        params.kind === "retake"
          ? resolveRetakeSiblingNodeName({
              sourceNodeName: sourceName,
              existingNodes: typedNodes,
            })
          : resolveTrimSiblingNodeName({
              sourceNodeName: sourceName,
              existingNodes: typedNodes,
            });
      const nodeId = `${AI_VIDEO_NODE_TYPE}-${params.kind}-${Date.now()}`;
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
        initialBusy: params.initialBusy,
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
    },
    [
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
    ]
  );

  return { createSiblingNodeShell };
}

export function useVideoTrimToSiblingNode(sourceNodeId: string) {
  const { createSiblingNodeShell } = useCreateAiVideoSiblingNode(sourceNodeId);
  const createTrimSiblingNodeShell = useCallback(
    (): CreateTrimSiblingNodeShellResult | null =>
      createSiblingNodeShell({ kind: "trim" }),
    [createSiblingNodeShell]
  );

  return { createTrimSiblingNodeShell };
}

export function useVideoRetakeToSiblingNode(sourceNodeId: string) {
  const { createSiblingNodeShell } = useCreateAiVideoSiblingNode(sourceNodeId);
  const createRetakeSiblingNodeShell = useCallback(
    (): CreateAiVideoSiblingNodeShellResult | null =>
      createSiblingNodeShell({ kind: "retake", initialBusy: "generating" }),
    [createSiblingNodeShell]
  );

  return { createRetakeSiblingNodeShell };
}

export interface CreateLockedRetakeCopyNodeResult {
  readonly nodeId: string;
}

export function useCreateLockedRetakeCopyNode(sourceNodeId: string) {
  const { nodeTypes = [], disabled, generativeReferenceCatalogs, updateNodeData } =
    useWorkflow();
  const nodes = useNodes();
  const edges = useEdges<ReactFlowEdge<WorkflowEdgeType>>();
  const { setNodes, setEdges, getNode, getViewport, setCenter } = useReactFlow();
  const { createObjectUrl } = useObjectService();
  const toast = useAppToast();
  const { id: workflowId } = useParams<{ id: string }>();

  const createLockedRetakeCopyNode = useCallback(
    (): CreateLockedRetakeCopyNodeResult | null => {
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
      const nodeName = resolveRetakeSiblingNodeName({
        sourceNodeName: sourceName,
        existingNodes: typedNodes,
      });
      const nodeId = `${AI_VIDEO_NODE_TYPE}-retake-${Date.now()}`;
      const position = findOpenNodePositionFromSource({
        sourceNode,
        targetNodeType: AI_VIDEO_NODE_TYPE,
        existingNodes: typedNodes,
      });

      const newNode = buildLockedRetakeCopyNode({
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
      if (!connection) {
        toast.error("workflow.videoRetake.referenceLinkFailed");
        return { nodeId };
      }

      const prepared = prepareWorkflowConnectionAppend({
        connection,
        nodes: nextNodes,
        edges,
        createObjectUrl: sourceData.createObjectUrl ?? createObjectUrl,
        generativeReferenceCatalogs,
        disabled,
      });
      if (!prepared) {
        toast.error("workflow.videoRetake.referenceLinkFailed");
        return { nodeId };
      }

      const referenceLinked = appendGenerativeReferenceConnection({
        connection,
        nodes: nextNodes,
        edges,
        setEdges,
        createObjectUrl: sourceData.createObjectUrl ?? createObjectUrl,
        generativeReferenceCatalogs,
        disabled,
      });
      if (!referenceLinked) {
        toast.error("workflow.videoRetake.referenceLinkFailed");
        return { nodeId };
      }

      if (updateNodeData) {
        updateNodeData(nodeId, (current) =>
          withAiVideoRetakeDraft(current, {
            primaryVideoEdgeId: prepared.edge.id,
          })
        );
      }

      const { width, height } = resolveWorkflowNodeDimensions(AI_VIDEO_NODE_TYPE);
      const centerX = position.x + width / 2;
      const centerY = position.y + height / 2;
      const { zoom } = getViewport();
      setCenter(centerX, centerY, { zoom, duration: 200 });

      return { nodeId };
    },
    [
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
      toast,
      updateNodeData,
      workflowId,
    ]
  );

  return { createLockedRetakeCopyNode };
}
