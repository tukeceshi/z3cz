import { AI_IMAGE_NODE_TYPE, type ObjectReference } from "@dafthunk/types";
import { useNodes, useReactFlow, type Node as ReactFlowNode } from "@xyflow/react";
import { useCallback, useState } from "react";

import { useAppToast } from "@/hooks/use-app-toast";
import { useObjectService } from "@/services/object-service";

import {
  captureVideoFrameBlob,
  formatVideoFrameSuffix,
  type VideoFrameCaptureMode,
} from "./capture-video-frame";
import {
  buildAiImageNodeFromFrameReference,
  computeVideoFrameAiImageNodePosition,
  findAiImageCatalog,
  resolveVideoFrameAiImageNodeName,
} from "./create-ai-image-node-from-video-frame";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

export function useVideoFrameToAiImageNode(sourceNodeId: string) {
  const { nodeTypes = [], disabled } = useWorkflow();
  const nodes = useNodes();
  const { setNodes, getNode } = useReactFlow();
  const { uploadBinaryData, createObjectUrl } = useObjectService();
  const toast = useAppToast();
  const [isCapturing, setIsCapturing] = useState(false);

  const captureFrameToAiImageNode = useCallback(
    async (video: HTMLVideoElement, mode: VideoFrameCaptureMode) => {
      if (disabled || isCapturing) {
        return;
      }

      const sourceNode = getNode(sourceNodeId);
      if (!sourceNode) {
        toast.error("workflow.aiVideoPanel.captureFrameFailed");
        return;
      }

      const catalog = findAiImageCatalog(nodeTypes);
      if (!catalog) {
        toast.error("workflow.aiVideoPanel.captureFrameFailed");
        return;
      }

      setIsCapturing(true);
      try {
        const { blob, capturedAtSeconds } = await captureVideoFrameBlob(
          video,
          mode
        );
        const arrayBuffer = await blob.arrayBuffer();
        const imageRef = (await uploadBinaryData(
          arrayBuffer,
          "image/jpeg"
        )) as ObjectReference;

        const sourceName =
          (sourceNode.data as WorkflowNodeType).name?.trim() || catalog.name;
        const frameSuffix = formatVideoFrameSuffix(mode, capturedAtSeconds);
        const typedNodes = nodes as unknown as readonly ReactFlowNode<WorkflowNodeType>[];
        const nodeName = resolveVideoFrameAiImageNodeName({
          sourceNodeName: sourceName,
          frameSuffix,
          existingNodes: typedNodes,
        });

        const newId = `${AI_IMAGE_NODE_TYPE}-frame-${Date.now()}`;
        const position = computeVideoFrameAiImageNodePosition(
          sourceNode.position,
          0
        );

        const newNode = buildAiImageNodeFromFrameReference({
          catalog,
          nodeId: newId,
          nodeName,
          position,
          imageRef,
          existingNodes: typedNodes,
          createObjectUrl,
        });

        setNodes((current) => [
          ...current.map((node) => ({ ...node, selected: false })),
          newNode,
        ]);

        toast.success("workflow.aiVideoPanel.captureFrameSuccess", {
          nodeName,
        });
      } catch {
        toast.error("workflow.aiVideoPanel.captureFrameFailed");
      } finally {
        setIsCapturing(false);
      }
    },
    [
      createObjectUrl,
      disabled,
      getNode,
      isCapturing,
      nodeTypes,
      nodes,
      setNodes,
      sourceNodeId,
      toast,
      uploadBinaryData,
    ]
  );

  return {
    captureFrameToAiImageNode,
    isCapturing,
  };
}
