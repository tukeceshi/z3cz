import type { AiGenerativeNodeType } from "@dafthunk/types";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { stageGenerativeCardUpload } from "@/services/stage-generative-media";
import { warmCardUploadPersist } from "@/services/generative-card-upload-persist";

import { withAiAudioGenerateError, withAiAudioManualUpload } from "./ai-audio-node-utils";
import { withAiImageGenerateError, withAiImageManualUpload } from "./ai-image-node-utils";
import { withAiVideoGenerateError, withAiVideoManualUpload } from "./ai-video-node-utils";
import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";
import { useCreativeStudio } from "./creative-studio-context";
import {
  resolveGenerativeCardUploadError,
  resolveGenerativeStudioDropFile,
  type GenerativeStudioDropFile,
} from "./generative-card-upload-utils";
import { withGenerativeUploadProgress } from "./generative-progress-utils";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { useWorkflow } from "./workflow-context";
import { useCallback, useState, type DragEvent } from "react";

export function useStudioGenerativeFileDrop() {
  const { t } = useTranslation();
  const toast = useAppToast();
  const { organization } = useAuth();
  const { updateNodeData } = useWorkflow();
  const { configured: cloudConfigured, blocksGenerativeMedia } =
    useCloudStorageCanvasContext();
  const { addGenerativeNode, workflowId } = useCreativeStudio();
  const orgId = organization?.id;
  const [uploading, setUploading] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);

  const uploadToNode = useCallback(
    async (nodeId: string, drop: GenerativeStudioDropFile) => {
      if (!updateNodeData || !orgId) {
        return;
      }

      setUploading(true);
      updateNodeData(nodeId, (current) => ({
        metadata: withGenerativeUploadProgress(current.metadata, true),
      }));

      try {
        const value = await stageGenerativeCardUpload({
          organizationId: orgId,
          workflowId,
          file: drop.file,
          cloudConfigured,
          mediaKind: drop.nodeType,
          nodeType: drop.nodeType,
        });

        if (workflowId) {
          warmCardUploadPersist({
            organizationId: orgId,
            workflowId,
            staged: value,
            nodeType: drop.nodeType,
            cloudConfigured,
          });
        }

        const uploadError = resolveGenerativeCardUploadError({
          value,
          cloudConfigured,
          t,
        });

        updateNodeData(nodeId, (current) => {
          const withMedia =
            drop.kind === "image"
              ? withAiImageManualUpload(current, [value])
              : drop.kind === "video"
                ? withAiVideoManualUpload(current, [value])
                : withAiAudioManualUpload(current, [value]);
          const withErrorMeta =
            drop.kind === "image"
              ? withAiImageGenerateError(withMedia.metadata, uploadError)
              : drop.kind === "video"
                ? withAiVideoGenerateError(withMedia.metadata, uploadError)
                : withAiAudioGenerateError(withMedia.metadata, uploadError);
          return {
            ...withMedia,
            metadata: withGenerativeUploadProgress(withErrorMeta, false),
          };
        });

        if (uploadError) {
          toast.errorRaw(uploadError.summary);
        }
      } catch (error) {
        const formatted = prepareGenerativeCardError(
          error instanceof Error ? error.message : String(error),
          t,
          drop.kind
        );
        updateNodeData(nodeId, (current) => ({
          metadata: withGenerativeUploadProgress(
            drop.kind === "image"
              ? withAiImageGenerateError(current.metadata, formatted)
              : drop.kind === "video"
                ? withAiVideoGenerateError(current.metadata, formatted)
                : withAiAudioGenerateError(current.metadata, formatted),
            false
          ),
        }));
        toast.errorRaw(formatted.summary);
      } finally {
        setUploading(false);
        updateNodeData(nodeId, (current) => ({
          metadata: withGenerativeUploadProgress(current.metadata, false),
        }));
      }
    },
    [cloudConfigured, orgId, t, toast, updateNodeData, workflowId]
  );

  const handleFileDrop = useCallback(
    async (fileList: FileList | null) => {
      if (uploading || blocksGenerativeMedia || !addGenerativeNode || !fileList?.length) {
        return;
      }

      if (!workflowId?.trim()) {
        toast.error("workflow.studio.addNodeDrop.missingWorkflow");
        return;
      }

      if (fileList.length > 1) {
        toast.error("workflow.studio.addNodeDrop.multipleFiles");
        return;
      }

      const drop = resolveGenerativeStudioDropFile(fileList[0]!);
      if (!drop) {
        toast.error("workflow.studio.addNodeDrop.invalidFile");
        return;
      }

      const nodeId = addGenerativeNode(drop.nodeType as AiGenerativeNodeType);
      if (!nodeId) {
        toast.error("workflow.canvas.nodeTypeUnavailable");
        return;
      }

      await uploadToNode(nodeId, drop);
    },
    [addGenerativeNode, blocksGenerativeMedia, toast, uploadToNode, uploading, workflowId]
  );

  const handleDragEnter = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    setFileDragOver(true);
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setFileDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setFileDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setFileDragOver(false);
      if (event.dataTransfer.types.includes("Files")) {
        void handleFileDrop(event.dataTransfer.files);
      }
    },
    [handleFileDrop]
  );

  return {
    uploading,
    fileDragOver,
    dropZoneProps: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
