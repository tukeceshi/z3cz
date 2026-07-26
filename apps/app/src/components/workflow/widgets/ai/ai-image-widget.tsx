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
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { stageGenerativeCardUpload } from "@/services/stage-generative-media";
import { isMediaExpired } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import {
  AiImageExpandButton,
  AiImageExpandOverlay,
} from "../../ai-image-expand-overlay";
import {
  AiImageHistoryButton,
  AiImageHistoryOverlay,
} from "../../ai-image-history-overlay";
import { readGenerativeProgressPhase } from "../../generative-progress-utils";
import {
  AI_IMAGE_CARD_HEIGHT_PX,
  AI_IMAGE_CARD_WIDTH_PX,
  isAiImageGenerating,
  readAiImageCardImages,
  readAiImageResultHistory,
  withAiImageHistorySelection,
  withAiImageGenerateError,
  withAiImageManualUpload,
} from "../../ai-image-node-utils";
import {
  GenerativeCardErrorBlock,
  GenerativeCardErrorDetailDialog,
} from "../../generative-card-error-block";
import { readGenerativeCardError } from "../../generative-card-error-utils";
import {
  shouldShowGenerativeHistoryIcon,
  withGenerativeCardEditing,
} from "../../generative-card-mode-utils";
import {
  normalizeGenerativeCardUploadFile,
  readGenerativePrompt,
  resolveGenerativeCardUploadError,
  withGenerativePromptCleared,
} from "../../generative-card-upload-utils";
import { prepareGenerativeCardError } from "../../prepare-generative-card-error";
import { GenerativeMediaDownloadButton, GENERATIVE_CARD_OVERLAY_BUTTON_CLASSNAME } from "../../generative-media-download-button";
import { useGenerativeCardDoubleClickUpload } from "../../use-generative-card-double-click-upload";
import { MediaImageField } from "../../fields/media-image-field";
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
  const [expandOpen, setExpandOpen] = useState(false);
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
  const { displayUrl: primaryImageUrl, stale: primaryImageStale } =
    useMediaDisplayUrl({
      media: primaryImage && !primaryImageExpired ? primaryImage : null,
      nodeType: "ai-image",
    });
  const canDownloadPrimaryImage =
    Boolean(primaryImage) &&
    Boolean(primaryImageUrl) &&
    !primaryImageStale &&
    !primaryImageExpired;
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

  const setCardEditing = useCallback(
    (editing: boolean) => {
      if (!updateNodeData) return;
      updateNodeData(nodeId, (current) => ({
        metadata: withGenerativeCardEditing(current.metadata, editing),
      }));
    },
    [nodeId, updateNodeData]
  );

  useEffect(() => {
    return () => {
      setCardEditing(false);
    };
  }, [setCardEditing]);

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

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (disabled || blocksGenerativeMedia || !files?.length || !updateNodeData || !orgId) return;

      const normalized = normalizeGenerativeCardUploadFile(files[0]!, "image");
      if (!normalized) {
        toast.error("workflow.fields.invalidImageFile");
        return;
      }

      setUploading(true);
      setCardEditing(true);
      try {
        const value = await stageGenerativeCardUpload({
          organizationId: orgId,
          workflowId,
          file: normalized,
          cloudConfigured,
          mediaKind: "ai-image",
          nodeType: "ai-image",
        });

        const uploadError = resolveGenerativeCardUploadError({
          value,
          cloudConfigured,
          t,
        });

        updateNodeData(nodeId, (current) => {
          const withMedia = withAiImageManualUpload(current, [value]);
          return {
            ...withMedia,
            metadata: withAiImageGenerateError(
              withMedia.metadata,
              uploadError
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
          metadata: withAiImageGenerateError(current.metadata, formatted),
        }));
        toast.errorRaw(formatted.summary);
      } finally {
        setUploading(false);
        setCardEditing(false);
      }
    },
    [
      cloudConfigured,
      disabled,
      blocksGenerativeMedia,
      nodeId,
      orgId,
      setCardEditing,
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
        accept="image/*"
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
          width: AI_IMAGE_CARD_WIDTH_PX,
          height: AI_IMAGE_CARD_HEIGHT_PX,
        }}
        onDoubleClick={(event) => {
          if (generateError) {
            event.stopPropagation();
            setErrorDetailOpen(true);
            return;
          }
          if (hasImages && !isGenerating) {
            event.stopPropagation();
            setExpandOpen(true);
            return;
          }
          if (!isGenerating) {
            handleCardDoubleClick(event);
          }
        }}
      >
        {!hasImages && !generateError ? (
          <div className="flex h-full items-center justify-center px-3">
            <p className="text-center text-[11px] italic text-muted-foreground/50">
              {cardPlaceholder}
            </p>
          </div>
        ) : hasImages ? (
          <div className={cn("grid h-full w-full gap-0", gridCols)}>
            {images.map((img, idx) => (
              <MediaImageField
                key={getMediaReferenceKey(img) ?? idx}
                value={img}
                createObjectUrl={createObjectUrl}
                className="h-full w-full min-h-0 rounded-none border-0"
              />
            ))}
          </div>
        ) : null}

        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}

        {!generateError ? (
          <div className="nodrag nopan nowheel absolute right-2 top-2 z-50 flex items-center gap-1.5">
            {canDownloadPrimaryImage && primaryImage && primaryImageUrl ? (
              <GenerativeMediaDownloadButton
                src={primaryImageUrl}
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
              <AiImageExpandButton onClick={() => setExpandOpen(true)} />
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

      {images.length > 0 ? (
        <AiImageExpandOverlay
          open={expandOpen}
          title={t("workflow.aiImagePanel.outputTitle")}
          images={images}
          createObjectUrl={createObjectUrl}
          onClose={() => setExpandOpen(false)}
        />
      ) : null}

      {showHistoryIcon ? (
        <AiImageHistoryOverlay
          open={historyOpen}
          history={historyItems}
          currentImages={images}
          createObjectUrl={createObjectUrl}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
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
