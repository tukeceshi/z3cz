import { AI_IMAGE_NODE_TYPE } from "@dafthunk/types";
import { useNodes, useReactFlow, type Node as ReactFlowNode } from "@xyflow/react";
import { useCallback, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useCreativeStudioOptional } from "@/components/workflow/creative-studio-context";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { warmCardUploadPersist } from "@/services/generative-card-upload-persist";
import { useObjectService } from "@/services/object-service";
import { stageGenerativeCardUpload } from "@/services/stage-generative-media";

import {
  captureVideoFrameBlob,
  formatVideoFrameSuffix,
  type VideoFrameCaptureMode,
} from "./capture-video-frame";
import {
  buildAiImageNodeFromFrameReference,
  findAiImageCatalog,
  resolveVideoFrameAiImageNodeName,
} from "./create-ai-image-node-from-video-frame";
import { findOpenNodePositionFromSource } from "./workflow-node-placement";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

export function useVideoFrameToAiImageNode(sourceNodeId: string) {
  const { nodeTypes = [], disabled } = useWorkflow();
  const nodes = useNodes();
  const { setNodes, getNode } = useReactFlow();
  const { createObjectUrl } = useObjectService();
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const { configured: cloudConfigured } = useCloudStorageCanvasContext();
  const studio = useCreativeStudioOptional();
  const toast = useAppToast();
  const [isCapturing, setIsCapturing] = useState(false);

  const captureFrameToAiImageNode = useCallback(
    async (video: HTMLVideoElement, mode: VideoFrameCaptureMode) => {
      if (disabled || isCapturing) {
        return;
      }

      if (!orgId || !workflowId) {
        toast.error("workflow.aiVideoPanel.captureFrameFailed");
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
        const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
        const staged = await stageGenerativeCardUpload({
          organizationId: orgId,
          workflowId,
          file,
          cloudConfigured,
          mediaKind: "ai-image",
          nodeType: "ai-image",
        });

        warmCardUploadPersist({
          organizationId: orgId,
          workflowId,
          staged,
          nodeType: "ai-image",
          cloudConfigured,
        });

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
        const position = findOpenNodePositionFromSource({
          sourceNode,
          targetNodeType: AI_IMAGE_NODE_TYPE,
          existingNodes: typedNodes,
        });

        const newNode = buildAiImageNodeFromFrameReference({
          catalog,
          nodeId: newId,
          nodeName,
          position,
          image: staged,
          createObjectUrl,
        });

        setNodes((current) => [
          ...current.map((node) => ({ ...node, selected: false })),
          newNode,
        ]);

        const openInSecondary =
          studio?.viewMode === "studio" &&
          studio.detailPaneOpen &&
          (studio.detailNodeId === sourceNodeId ||
            studio.secondaryNodeId === sourceNodeId);

        if (openInSecondary) {
          studio.markPendingSecondaryNode(newId);
          studio.openSecondaryDetail(newId);
          toast.success("workflow.aiVideoPanel.captureFrameSuccessInSecondary", {
            nodeName,
          });
        } else {
          toast.success("workflow.aiVideoPanel.captureFrameSuccess", {
            nodeName,
          });
        }
      } catch {
        toast.error("workflow.aiVideoPanel.captureFrameFailed");
      } finally {
        setIsCapturing(false);
      }
    },
    [
      cloudConfigured,
      createObjectUrl,
      disabled,
      getNode,
      isCapturing,
      nodeTypes,
      nodes,
      orgId,
      setNodes,
      sourceNodeId,
      studio,
      toast,
      workflowId,
    ]
  );

  return {
    captureFrameToAiImageNode,
    isCapturing,
  };
}
