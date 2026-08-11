import {
  AI_IMAGE_NODE_TYPE,
  getMediaReferenceKey,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";
import { useCallback, useRef, useState } from "react";
import { useParams } from "react-router";
import ZoomInIcon from "lucide-react/icons/zoom-in";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { useGenerativeMediaWorkSession } from "@/hooks/use-generative-media-before-unload";
import { generativeCardProgressKey } from "@/hooks/use-generative-cloud-job";
import { useCanvasCardSize } from "@/hooks/use-canvas-card-size";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
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
  readAiImageCardPrimaryImage,
  readAiImageResultHistory,
  withAiImageHistorySelection,
  withAiImageGenerateError,
  withAiImageManualUpload,
} from "../../ai-image-node-utils";
import { commitGenerativeHistorySelection } from "../../commit-generative-history-selection";
import { useExpandHistoryToSiblingNode } from "../../use-expand-history-to-sibling-node";
import {
  useGenerativeHistoryModels,
  useHistoryModelUnavailableToast,
} from "../../use-generative-history-models";
import {
  GenerativeCardErrorBlock,
  GenerativeCardErrorDetailDialog,
} from "../../generative-card-error-block";
import { readGenerativeCardError } from "../../generative-card-error-utils";
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
import { GenerativeCardEmptyUploadSlot } from "../../generative-card-empty-upload-slot";
import { useGenerativeCardUpload } from "../../use-generative-card-upload";
import { CanvasMediaCover } from "../../canvas-media-cover";
import {
  StudioImagePhotoProvider,
  StudioImageZoomHiddenTrigger,
} from "../../studio-image-lightbox";
import { useWorkflow } from "../../workflow-context";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiImageWidgetProps extends BaseWidgetProps {
  primaryImage: MediaReference | undefined;
  historyItems: ReturnType<typeof readAiImageResultHistory>;
  nodeId: string;
  prompt: string;
  metadata?: Record<string, string>;
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

function AiImageWidget({
  primaryImage,
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
  const imageZoomTriggerRef = useRef<HTMLButtonElement>(null);
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
  const hasImage = primaryImage != null;
  const primaryImageExpired = primaryImage ? isMediaExpired(primaryImage) : false;
  const primaryImageKey = primaryImage
    ? getMediaReferenceKey(primaryImage)
    : null;
  const canDownloadPrimaryImage = Boolean(primaryImage) && !primaryImageExpired;
  const { displayUrl: imageDisplayUrl } = useMediaDisplayUrl({
    media: canDownloadPrimaryImage && primaryImage ? primaryImage : null,
    nodeType: "ai-image",
    size: "full",
    localOnly: true,
  });
  const { cardSize, onNaturalSize } = useCanvasCardSize({
    kind: "image",
    hasMedia: hasImage,
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

  const { canUpload, handleUploadClick, uploadConfirmDialog } =
    useGenerativeCardUpload({
      prompt,
      hasMedia: hasImage,
      isGenerating,
      disabled,
      blocksGenerativeMedia,
      uploading,
      fileInputRef,
      onClearPrompt: handleClearPrompt,
      i18nPrefix: "workflow.aiImagePanel",
    });

  const historyModels = useGenerativeHistoryModels();
  const notifyHistoryModelUnavailable = useHistoryModelUnavailableToast();

  const handleHistorySelect = useCallback(
    (id: string) => {
      if (disabled || !updateNodeData) return;
      const item = historyItems.items.find((entry) => entry.id === id);
      if (!item) return;

      let modelUnavailable = false;
      updateNodeData(nodeId, (current) => {
        const result = withAiImageHistorySelection(current, id, {
          models: historyModels.image,
        });
        const committed = commitGenerativeHistorySelection(result);
        modelUnavailable = committed.modelUnavailable;
        return committed.patch;
      });
      notifyHistoryModelUnavailable(modelUnavailable);
    },
    [
      disabled,
      historyItems.items,
      historyModels.image,
      nodeId,
      notifyHistoryModelUnavailable,
      updateNodeData,
    ]
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

  const handleOpenImageZoom = useCallback(() => {
    imageZoomTriggerRef.current?.click();
  }, []);

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
          t,
          "image"
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
      <StudioImagePhotoProvider>
        {canDownloadPrimaryImage && primaryImage && imageDisplayUrl ? (
          <StudioImageZoomHiddenTrigger
            src={imageDisplayUrl}
            triggerRef={imageZoomTriggerRef}
          />
        ) : null}
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
            if (!isGenerating) {
              event.stopPropagation();
              openCreativeStudio();
            }
          }}
        >
          {!hasImage && !generateError ? (
            <GenerativeCardEmptyUploadSlot
              kind="image"
              size="canvas"
              doubleClickHintKey="workflow.studio.cardDoubleClickOpenStudio"
              busy={isGenerating || uploading}
              busyMessage={cardPlaceholder}
              canUpload={canUpload}
              onUploadClick={handleUploadClick}
            />
          ) : primaryImage ? (
            <CanvasMediaCover
              media={primaryImage}
              nodeType="ai-image"
              cardWidthPx={cardSize.width}
              cardHeightPx={cardSize.height}
              fitMode="cover"
              className="h-full w-full rounded-none border-0"
              onNaturalSize={onNaturalSize}
            />
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
              {hasImage ? (
                <AiImageExpandButton onClick={openCreativeStudio} />
              ) : null}
            </div>
          ) : null}

          {!generateError && canDownloadPrimaryImage && primaryImage ? (
            <div className="nodrag nopan nowheel absolute bottom-2 right-2 z-50">
              <button
                type="button"
                className="nodrag nopan nowheel flex h-6 w-6 shrink-0 items-center justify-center text-white/75 transition-colors hover:text-white"
                title={t("workflow.studio.viewImage")}
                aria-label={t("workflow.studio.viewImage")}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenImageZoom();
                }}
              >
                <ZoomInIcon className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ) : null}
        </div>
      </StudioImagePhotoProvider>

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
          currentImages={primaryImage ? [primaryImage] : []}
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
    primaryImage: readAiImageCardPrimaryImage(inputs, outputs, metadata),
    historyItems: readAiImageResultHistory(inputs),
    nodeId,
    prompt: readGenerativePrompt(inputs),
    metadata,
  }),
});
