import type { AiGenerativeNodeType, PatchNodeLayoutMetadata } from "@dafthunk/types";
import type { ReactFlowInstance } from "@xyflow/react";
import { useCallback, useRef, useState, type DragEvent } from "react";

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
  buildCanvasFileDropPreviewState,
  CANVAS_FILE_DROP_PREVIEW_IDLE,
  CANVAS_GENERATIVE_FILE_DROP_MAX,
  resolveCanvasFileDropDropCenters,
  resolveCanvasFileDropNodePosition,
  resolveCanvasFileDropPreviewKinds,
  resolveGenerativeCardUploadError,
  resolveGenerativeStudioDropFile,
  type CanvasFileDropPreviewState,
  type GenerativeStudioDropFile,
} from "./generative-card-upload-utils";
import { withGenerativeUploadProgress } from "./generative-progress-utils";
import type { MediaCardSize } from "./media-card-size";
import { createPatchNodeLayoutMetadata } from "./patch-node-layout-metadata";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import { probeLocalFileCardSize } from "./resolve-local-file-card-size";
import { hasStudioReferenceDrag } from "./studio-reference-drag";
import type { AddGenerativeNodesBatchItem } from "./use-graph-operations";
import { useWorkflow } from "./workflow-context";
import { getViewportCenterFlowPoint } from "./workflow-node-placement";

interface GenerativeDropUploadParams {
  readonly nodeId: string;
  readonly drop: GenerativeStudioDropFile;
  readonly organizationId: string;
  readonly workflowId: string | undefined;
  readonly cloudConfigured: boolean;
  readonly patchNodeLayout?: PatchNodeLayoutMetadata;
  readonly updateNodeData: NonNullable<ReturnType<typeof useWorkflow>["updateNodeData"]>;
  readonly t: ReturnType<typeof useTranslation>["t"];
  readonly toast: ReturnType<typeof useAppToast>;
}

async function uploadGenerativeDropToNode(
  params: GenerativeDropUploadParams
): Promise<void> {
  params.updateNodeData(params.nodeId, (current) => ({
    metadata: withGenerativeUploadProgress(current.metadata, true),
  }));

  try {
    const value = await stageGenerativeCardUpload({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      file: params.drop.file,
      cloudConfigured: params.cloudConfigured,
      mediaKind: params.drop.nodeType,
      nodeType: params.drop.nodeType,
      patchNodeLayout: params.patchNodeLayout,
    });

    if (params.workflowId) {
      warmCardUploadPersist({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        staged: value,
        nodeType: params.drop.nodeType,
        cloudConfigured: params.cloudConfigured,
      });
    }

    const uploadError = resolveGenerativeCardUploadError({
      value,
      cloudConfigured: params.cloudConfigured,
      t: params.t,
    });

    params.updateNodeData(params.nodeId, (current) => {
      const withMedia =
        params.drop.kind === "image"
          ? withAiImageManualUpload(current, [value])
          : params.drop.kind === "video"
            ? withAiVideoManualUpload(current, [value])
            : withAiAudioManualUpload(current, [value]);
      const withErrorMeta =
        params.drop.kind === "image"
          ? withAiImageGenerateError(withMedia.metadata, uploadError)
          : params.drop.kind === "video"
            ? withAiVideoGenerateError(withMedia.metadata, uploadError)
            : withAiAudioGenerateError(withMedia.metadata, uploadError);
      return {
        ...withMedia,
        metadata: withGenerativeUploadProgress(withErrorMeta, false),
      };
    });

    if (uploadError) {
      params.toast.errorRaw(uploadError.summary);
    }
  } catch (error) {
    const formatted = prepareGenerativeCardError(
      error instanceof Error ? error.message : String(error),
      params.t,
      params.drop.kind
    );
    params.updateNodeData(params.nodeId, (current) => ({
      metadata: withGenerativeUploadProgress(
        params.drop.kind === "image"
          ? withAiImageGenerateError(current.metadata, formatted)
          : params.drop.kind === "video"
            ? withAiVideoGenerateError(current.metadata, formatted)
            : withAiAudioGenerateError(current.metadata, formatted),
        false
      ),
    }));
    params.toast.errorRaw(formatted.summary);
  } finally {
    params.updateNodeData(params.nodeId, (current) => ({
      metadata: withGenerativeUploadProgress(current.metadata, false),
    }));
  }
}

function startGenerativeDropUpload(params: GenerativeDropUploadParams): void {
  void uploadGenerativeDropToNode(params);
}

function scheduleCanvasDropNodeSelection(params: {
  readonly nodeIds: readonly string[];
  readonly generationRef: { readonly current: number };
  readonly onSelectDroppedNodes?: (nodeIds: readonly string[]) => void;
}): void {
  if (params.nodeIds.length === 0 || !params.onSelectDroppedNodes) {
    return;
  }

  const droppedNodeIds = [...params.nodeIds];
  const selectGeneration = params.generationRef.current + 1;
  params.generationRef.current = selectGeneration;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (params.generationRef.current !== selectGeneration) {
        return;
      }
      params.onSelectDroppedNodes?.(droppedNodeIds);
    });
  });
}

function startCanvasDropUploads(params: {
  readonly nodeIds: readonly string[];
  readonly drops: readonly GenerativeStudioDropFile[];
  readonly cardSizes: readonly MediaCardSize[];
  readonly upload: Omit<GenerativeDropUploadParams, "nodeId" | "drop" | "patchNodeLayout">;
  readonly updateNodeData: NonNullable<ReturnType<typeof useWorkflow>["updateNodeData"]>;
}): void {
  params.nodeIds.forEach((nodeId, index) => {
    const drop = params.drops[index];
    const cardSize = params.cardSizes[index];
    if (!drop || !cardSize) {
      return;
    }

    startGenerativeDropUpload({
      nodeId,
      drop,
      patchNodeLayout: createPatchNodeLayoutMetadata(nodeId, params.updateNodeData),
      ...params.upload,
    });
  });
}

function isCanvasFileDrag(dataTransfer: DataTransfer): boolean {
  return (
    dataTransfer.types.includes("Files") && !hasStudioReferenceDrag(dataTransfer)
  );
}

function isCanvasFileDropOnNode(event: DragEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(".react-flow__node"));
}

export function useCanvasGenerativeFileDrop(params: {
  readonly reactFlowInstance: ReactFlowInstance | null;
  readonly enabled: boolean;
  readonly onAddCanvasDropNodes?: (
    items: readonly AddGenerativeNodesBatchItem[]
  ) => readonly string[];
  readonly onSelectDroppedNodes?: (nodeIds: readonly string[]) => void;
}) {
  const { t } = useTranslation();
  const toast = useAppToast();
  const { organization } = useAuth();
  const { updateNodeData } = useWorkflow();
  const { configured: cloudConfigured, blocksGenerativeMedia } =
    useCloudStorageCanvasContext();
  const { workflowId } = useCreativeStudio();
  const orgId = organization?.id;
  const [fileDropPreview, setFileDropPreview] = useState<CanvasFileDropPreviewState>(
    CANVAS_FILE_DROP_PREVIEW_IDLE
  );
  const [isDropping, setIsDropping] = useState(false);
  const dropSelectGenerationRef = useRef(0);

  const clearPreview = useCallback(() => {
    setFileDropPreview(CANVAS_FILE_DROP_PREVIEW_IDLE);
  }, []);

  const handleCanvasDragOver = useCallback(
    (event: DragEvent) => {
      if (
        !params.enabled ||
        !params.reactFlowInstance ||
        !isCanvasFileDrag(event.dataTransfer)
      ) {
        return;
      }

      if (isCanvasFileDropOnNode(event)) {
        clearPreview();
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";

      const baseCenter = params.reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const kinds = resolveCanvasFileDropPreviewKinds(event.dataTransfer);
      setFileDropPreview(
        buildCanvasFileDropPreviewState({ baseCenter, kinds })
      );
    },
    [clearPreview, params.enabled, params.reactFlowInstance]
  );

  const handleCanvasDragLeave = useCallback(
    (event: DragEvent) => {
      if (!params.enabled) {
        return;
      }

      const related = event.relatedTarget;
      if (related instanceof Element && event.currentTarget.contains(related)) {
        return;
      }

      clearPreview();
    },
    [clearPreview, params.enabled]
  );

  const ingestCanvasFiles = useCallback(
    async (
      files: readonly File[],
      baseCenter: { readonly x: number; readonly y: number }
    ) => {
      if (
        isDropping ||
        !params.enabled ||
        !params.reactFlowInstance ||
        !params.onAddCanvasDropNodes ||
        !updateNodeData ||
        !orgId ||
        blocksGenerativeMedia
      ) {
        return;
      }

      if (!workflowId?.trim()) {
        toast.error("workflow.studio.addNodeDrop.missingWorkflow");
        return;
      }

      if (files.length === 0) {
        return;
      }

      if (files.length > CANVAS_GENERATIVE_FILE_DROP_MAX) {
        toast.error("workflow.canvas.fileDrop.maxCount", {
          max: CANVAS_GENERATIVE_FILE_DROP_MAX,
        });
        return;
      }

      const drops = files.map((file) => resolveGenerativeStudioDropFile(file));
      if (drops.some((drop) => drop === null)) {
        toast.error("workflow.studio.addNodeDrop.invalidFile");
        return;
      }

      setIsDropping(true);
      try {
        const resolvedDrops = drops as GenerativeStudioDropFile[];
        const cardSizes = await Promise.all(
          resolvedDrops.map((drop) =>
            probeLocalFileCardSize(drop.file, drop.kind)
          )
        );
        const centers = resolveCanvasFileDropDropCenters(baseCenter, cardSizes);
        const batchItems: AddGenerativeNodesBatchItem[] = [];
        const batchDrops: GenerativeStudioDropFile[] = [];
        const batchCardSizes: MediaCardSize[] = [];
        for (let index = 0; index < resolvedDrops.length; index += 1) {
          const drop = resolvedDrops[index]!;
          const center = centers[index];
          const cardSize = cardSizes[index];
          if (!center || !cardSize) {
            continue;
          }
          batchItems.push({
            nodeType: drop.nodeType as AiGenerativeNodeType,
            positionFlowPoint: resolveCanvasFileDropNodePosition(center, cardSize),
            layout: cardSize,
            manualContent: true,
          });
          batchDrops.push(drop);
          batchCardSizes.push(cardSize);
        }

        if (batchItems.length === 0) {
          return;
        }

        const nodeIds = params.onAddCanvasDropNodes(batchItems);
        if (nodeIds.length === 0) {
          toast.error("workflow.canvas.nodeTypeUnavailable");
          return;
        }

        if (nodeIds.length !== batchItems.length) {
          toast.error("workflow.canvas.nodeTypeUnavailable");
          return;
        }

        startCanvasDropUploads({
          nodeIds,
          drops: batchDrops,
          cardSizes: batchCardSizes,
          upload: {
            organizationId: orgId,
            workflowId,
            cloudConfigured,
            updateNodeData,
            t,
            toast,
          },
          updateNodeData,
        });

        scheduleCanvasDropNodeSelection({
          nodeIds,
          generationRef: dropSelectGenerationRef,
          onSelectDroppedNodes: params.onSelectDroppedNodes,
        });
      } finally {
        setIsDropping(false);
      }
    },
    [
      blocksGenerativeMedia,
      cloudConfigured,
      isDropping,
      orgId,
      params.enabled,
      params.onAddCanvasDropNodes,
      params.onSelectDroppedNodes,
      params.reactFlowInstance,
      t,
      toast,
      updateNodeData,
      workflowId,
    ]
  );

  const handleCanvasDrop = useCallback(
    async (event: DragEvent) => {
      event.preventDefault();
      clearPreview();

      if (
        !params.reactFlowInstance ||
        !isCanvasFileDrag(event.dataTransfer) ||
        isCanvasFileDropOnNode(event)
      ) {
        return;
      }

      const files = [...event.dataTransfer.files];
      const baseCenter = params.reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      await ingestCanvasFiles(files, baseCenter);
    },
    [clearPreview, ingestCanvasFiles, params.reactFlowInstance]
  );

  const handleCanvasFilePick = useCallback(
    (files: readonly File[]) => {
      if (!params.reactFlowInstance) {
        return;
      }

      void ingestCanvasFiles(
        files,
        getViewportCenterFlowPoint(params.reactFlowInstance)
      );
    },
    [ingestCanvasFiles, params.reactFlowInstance]
  );

  return {
    fileDropPreview,
    handleCanvasDragOver,
    handleCanvasDragLeave,
    handleCanvasDrop,
    handleCanvasFilePick,
  };
}

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

  const startStudioListUpload = useCallback(
    (nodeId: string, drop: GenerativeStudioDropFile) => {
      if (!updateNodeData || !orgId) {
        return;
      }

      startGenerativeDropUpload({
        nodeId,
        drop,
        organizationId: orgId,
        workflowId,
        cloudConfigured,
        patchNodeLayout: createPatchNodeLayoutMetadata(nodeId, updateNodeData),
        updateNodeData,
        t,
        toast,
      });
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

      setUploading(true);
      try {
        const nodeId = addGenerativeNode(drop.nodeType as AiGenerativeNodeType);
        if (!nodeId) {
          toast.error("workflow.canvas.nodeTypeUnavailable");
          return;
        }

        startStudioListUpload(nodeId, drop);
      } finally {
        setUploading(false);
      }
    },
    [
      addGenerativeNode,
      blocksGenerativeMedia,
      startStudioListUpload,
      toast,
      uploading,
      workflowId,
    ]
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
