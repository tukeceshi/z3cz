import {
  AI_IMAGE_NODE_TYPE,
  getMediaReferenceKey,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { useGenerativeMediaWorkSession } from "@/hooks/use-generative-media-before-unload";
import { generativeCardProgressKey } from "@/hooks/use-generative-cloud-job";
import { useCanvasCardSize } from "@/hooks/use-canvas-card-size";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { stageGenerativeCardUpload } from "@/services/stage-generative-media";
import { warmCardUploadPersist } from "@/services/generative-card-upload-persist";
import { isMediaExpired } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import {
  AiImageExpandButton,
} from "../../ai-image-expand-overlay";
import { useOpenCreativeStudio } from "../../creative-studio-context";
import {
  AiImageHistoryButton,
  AiImageHistoryOverlay,
} from "../../ai-image-history-overlay";
import {
  readGenerativeProgressPhase,
  withGenerativeUploadProgress,
} from "../../generative-progress-utils";
import {
  isAiImageGenerating,
  readAiImageCardImages,
  readAiImageResultHistory,
  withAiImageHistorySelection,
  withAiImageGenerateError,
  withAiImageManualUpload,
} from "../../ai-image-node-utils";
import { useExpandHistoryToSiblingNode } from "../../use-expand-history-to-sibling-node";
import {
  GenerativeCardErrorBlock,
  GenerativeCardErrorDetailDialog,
} from "../../generative-card-error-block";
import { readGenerativeCardError } from "../../generative-card-error-utils";
import { GENERATIVE_CARD_STATE_LABEL_CLASS } from "../../generative-card-styles";
import {
  shouldShowGenerativeHistoryIcon,
} from "../../generative-card-mode-utils";
import {
  GENERATIVE_IMAGE_UPLOAD_ACCEPT,
  normalizeGenerativeCardUploadFile,
  readGenerativePrompt,
  resolveGenerativeCardUploadError,
  withGenerativePromptCleared,
} from "../../generative-card-upload-utils";
import { prepareGenerativeCardError } from "../../prepare-generative-card-error";
import { GenerativeMediaLazyDownloadButton, GENERATIVE_CARD_OVERLAY_BUTTON_CLASSNAME } from "../../generative-media-download-button";
import { useGenerativeCardDoubleClickUpload } from "../../use-generative-card-double-click-upload";
import { CanvasMediaCover } from "../../canvas-media-cover";
import { useWorkflow } from "../../workflow-context";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiImageWidgetProps extends BaseWidgetProps {
  images: MediaReference[];
  historyItems: ReturnType<typeof readAiImageResultHistory>;
  nodeId: string;
  prompt: string;
  metadata?: Record<string, string>;
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

function AiImageWidget({
  images,
  historyItems,
  disabled = false,
  className,
  nodeId,
  prompt,
  metadata,
  createObjectUrl,
}: AiImageWidgetProps) {
  const { t } = useTranslation();
  const toast = useAppToast();
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const { configured: cloudConfigured, blocksGenerativeMedia } =
    useCloudStorageCanvasContext();
  const { updateNodeData } = useWorkflow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openCreativeStudio = useOpenCreativeStudio(nodeId);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const progressPhase = readGenerativeProgressPhase(metadata);
  const isGenerating =
    isAiImageGenerating(metadata) || progressPhase !== undefined;
  useGenerativeMediaWorkSession(uploading || progressPhase !== undefined);
  const generateError = readGenerativeCardError(metadata);
  const hasImages = images.length > 0;
  const primaryImage = images[0];
  const primaryImageExpired = primaryImage ? isMediaExpired(primaryImage) : false;
  const primaryImageKey = primaryImage
    ? getMediaReferenceKey(primaryImage)
    : null;
  const canDownloadPrimaryImage = Boolean(primaryImage) && !primaryImageExpired;
  const { cardSize, onNaturalSize } = useCanvasCardSize({
    kind: "image",
    hasMedia: hasImages,
    mediaKey: primaryImageKey,
  });
  const cardPlaceholder = t(
    generativeCardProgressKey(
      progressPhase ??
        (isAiImageGenerating(metadata) ? "generating" : null),
      "image"
    )
  );

  const handleClearPrompt = useCallback(() => {
    if (!updateNodeData) return;
    updateNodeData(nodeId, (current) => ({
      inputs: withGenerativePromptCleared(current.inputs),
    }));
  }, [nodeId, updateNodeData]);

  const isUploadBlocked = disabled || blocksGenerativeMedia;

  const { handleCardDoubleClick, uploadConfirmDialog } =
    useGenerativeCardDoubleClickUpload({
      prompt,
      hasMedia: images.length > 0,
      isGenerating,
      disabled,
      blocksGenerativeMedia,
      uploading,
      fileInputRef,
      onClearPrompt: handleClearPrompt,
      i18nPrefix: "workflow.aiImagePanel",
    });

  const handleHistorySelect = useCallback(
    (id: string) => {
      if (disabled || !updateNodeData) return;
      const item = historyItems.items.find((entry) => entry.id === id);
      if (!item) return;

      updateNodeData(nodeId, (current) =>
        withAiImageHistorySelection(current, id)
      );
    },
    [disabled, historyItems.items, nodeId, updateNodeData]
  );

  const expandHistoryItem = useExpandHistoryToSiblingNode(nodeId, "image");

  const handleHistoryExpand = useCallback(
    (id: string) => {
      const item = historyItems.items.find((entry) => entry.id === id);
      const media = item?.images[0];
      if (!item || !media) return;
      expandHistoryItem({
        media,
        prompt: item.prompt,
        params: item.params,
        platformModelId: item.platformModelId,
        aiInterfaceId: item.aiInterfaceId,
        modelDisplayName: item.modelDisplayName,
        createdAt: item.createdAt,
      });
    },
    [expandHistoryItem, historyItems.items]
  );

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (disabled || blocksGenerativeMedia || !files?.length || !updateNodeData || !orgId || !workflowId) return;

      const normalized = normalizeGenerativeCardUploadFile(files[0]!, "image");
      if (!normalized) {
        toast.error("workflow.fields.invalidImageFile");
        return;
      }

      setUploading(true);
      updateNodeData(nodeId, (current) => ({
        metadata: withGenerativeUploadProgress(current.metadata, true),
      }));
      try {
        const staged = await stageGenerativeCardUpload({
          organizationId: orgId,
          workflowId,
          file: normalized,
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

        const uploadError = resolveGenerativeCardUploadError({
          value: staged,
          cloudConfigured,
          t,
        });

        updateNodeData(nodeId, (current) => {
          const withMedia = withAiImageManualUpload(current, [staged]);
          return {
            ...withMedia,
            metadata: withGenerativeUploadProgress(
              withAiImageGenerateError(withMedia.metadata, uploadError),
              false
            ),
          };
        });

        if (uploadError) {
          toast.errorRaw(uploadError.summary);
        }
      } catch (error) {
        const formatted = prepareGenerativeCardError(
          error instanceof Error ? error.message : String(error),
          t
        );
        updateNodeData(nodeId, (current) => ({
          metadata: withGenerativeUploadProgress(
            withAiImageGenerateError(current.metadata, formatted),
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
    [
      cloudConfigured,
      disabled,
      blocksGenerativeMedia,
      nodeId,
      orgId,
      t,
      toast,
      updateNodeData,
      workflowId,
    ]
  );

  const gridCols =
    images.length === 1
      ? "grid-cols-1"
      : images.length <= 4
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <>
      {uploadConfirmDialog}
      <input
        ref={fileInputRef}
        type="file"
        accept={GENERATIVE_IMAGE_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void handleUploadFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div
        className={cn(
          "relative h-full w-full overflow-hidden cursor-grab select-none",
          uploading && "opacity-70",
          className
        )}
        style={{
          width: cardSize.width,
          height: cardSize.height,
        }}
        onDoubleClick={(event) => {
          if (generateError) {
            event.stopPropagation();
            setErrorDetailOpen(true);
            return;
          }
          if (hasImages && !isGenerating) {
            event.stopPropagation();
            openCreativeStudio();
            return;
          }
          if (!isGenerating) {
            handleCardDoubleClick(event);
          }
        }}
      >
        {!hasImages && !generateError ? (
          <div className="flex h-full items-center justify-center px-3">
            <p className={GENERATIVE_CARD_STATE_LABEL_CLASS}>
              {cardPlaceholder}
            </p>
          </div>
        ) : hasImages ? (
          <div className={cn("grid h-full w-full gap-0", gridCols)}>
            {images.map((img, idx) => (
              <CanvasMediaCover
                key={getMediaReferenceKey(img) ?? idx}
                media={img}
                nodeType="ai-image"
                cardWidthPx={cardSize.width}
                cardHeightPx={cardSize.height}
                fitMode="cover"
                className="h-full w-full min-h-0 rounded-none border-0"
                onNaturalSize={idx === 0 ? onNaturalSize : undefined}
              />
            ))}
          </div>
        ) : null}

        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}

        {!generateError ? (
          <div className="nodrag nopan nowheel absolute right-2 top-2 z-50 flex items-center gap-1.5">
            {canDownloadPrimaryImage && primaryImage ? (
              <GenerativeMediaLazyDownloadButton
                media={primaryImage}
                nodeType="ai-image"
                fileName={`image-${getMediaReferenceKey(primaryImage)}.${primaryImage.mimeType.split("/")[1] ?? "png"}`}
                className={GENERATIVE_CARD_OVERLAY_BUTTON_CLASSNAME}
              />
            ) : null}
            {showHistoryIcon ? (
              <AiImageHistoryButton
                count={historyItems.items.length}
                onClick={() => setHistoryOpen(true)}
              />
            ) : null}
            {hasImages ? (
              <AiImageExpandButton onClick={openCreativeStudio} />
            ) : null}
          </div>
        ) : null}
      </div>

      {generateError ? (
        <GenerativeCardErrorDetailDialog
          error={generateError}
          open={errorDetailOpen}
          onOpenChange={setErrorDetailOpen}
        />
      ) : null}

      {showHistoryIcon ? (
        <AiImageHistoryOverlay
          open={historyOpen}
          history={historyItems}
          currentImages={images}
          mediaKind="image"
          createObjectUrl={createObjectUrl}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
          onExpandToNode={handleHistoryExpand}
        />
      ) : null}
    </>
  );
}

export const aiImageWidget = createWidget({
  component: AiImageWidget,
  nodeTypes: [AI_IMAGE_NODE_TYPE],
  inputField: "prompt",
  managedFields: [
    "model",
    "prompt",
    "count",
    "params",
    "manual_images",
    "images_result",
    "images_history",
    "reference_images",
    "ai_interface_id",
  ],
  extractConfig: (nodeId, inputs, outputs, metadata) => ({
    images: readAiImageCardImages(inputs, outputs, metadata),
    historyItems: readAiImageResultHistory(inputs),
    nodeId,
    prompt: readGenerativePrompt(inputs),
    metadata,
  }),
});
