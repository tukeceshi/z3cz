import {
  AI_IMAGE_NODE_TYPE,
  getResourceIdFromValue,
  hasDisplayableWorkflowMedia,
  hasFailedResource,
  hasGeneratingResource,
  isMediaReference,
  type MediaReference,
  type ObjectReference,
  readNodeLayoutFromMetadata,
} from "@dafthunk/types";
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import ZoomInIcon from "lucide-react/icons/zoom-in";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { useGenerativeRecordErrorDisplay } from "@/hooks/use-generative-record-error-display";
import { useGenerativeMediaWorkSession } from "@/hooks/use-generative-media-before-unload";
import { generativeCardProgressKey } from "@/hooks/use-generative-cloud-job";
import { formatGenerativePhaseLabel } from "@/components/workflow/generative-progress-utils";
import { useCanvasCardSize } from "@/hooks/use-canvas-card-size";
import { useGenerativeCardMediaDisplay } from "@/hooks/use-media-display-url";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { stageGenerativeCardUpload } from "@/services/stage-generative-media";
import { warmCardUploadPersist } from "@/services/generative-card-upload-persist";
import { isMediaExpired } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import { useOpenCreativeStudio } from "../../creative-studio-context";
import { GenerativeCloudAccelerationCardOffer } from "../../generative-cloud-acceleration-card-offer";
import {
  isGenerativePersistPhase,
  readGenerativeProgressPhase,
  withGenerativeUploadProgress,
} from "../../generative-progress-utils";
import type { GenerativeCardCoverRead } from "../../generative-history-utils";
import {
  readAiImageCardDisplay,
  readAiImageResultHistory,
  withAiImageGenerateError,
  withAiImageManualUpload,
} from "../../ai-image-node-utils";
import {
  GenerativeCardErrorBlock,
  GenerativeCardErrorDetailDialog,
} from "../../generative-card-error-block";
import { readGenerativeCardError } from "../../generative-card-error-utils";
import {
  GENERATIVE_IMAGE_UPLOAD_ACCEPT,
  normalizeGenerativeCardUploadFile,
  readGenerativePrompt,
  resolveGenerativeCardUploadError,
  withGenerativePromptCleared,
} from "../../generative-card-upload-utils";
import { prepareGenerativeCardError } from "../../prepare-generative-card-error";
import { createPatchNodeLayoutMetadata } from "../../patch-node-layout-metadata";
import { GenerativeCardEmptyUploadSlot } from "../../generative-card-empty-upload-slot";
import { useGenerativeCardUpload } from "../../use-generative-card-upload";
import { CanvasMediaCover } from "../../canvas-media-cover";
import { useWorkflow } from "../../workflow-context";
import { useGenerativeNodeCardHydrateById } from "../../use-generative-node-card-hydrate";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

const StudioImagePhotoProvider = lazy(() =>
  import("../../studio-image-lightbox").then((module) => ({
    default: module.StudioImagePhotoProvider,
  }))
);
const StudioImageZoomHiddenTrigger = lazy(() =>
  import("../../studio-image-lightbox").then((module) => ({
    default: module.StudioImageZoomHiddenTrigger,
  }))
);

interface AiImageWidgetProps extends BaseWidgetProps {
  cardDisplay: GenerativeCardCoverRead<MediaReference>;
  historyItems: ReturnType<typeof readAiImageResultHistory>;
  nodeId: string;
  prompt: string;
  metadata?: Record<string, string>;
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

function AiImageWidget({
  cardDisplay,
  historyItems,
  disabled = false,
  className,
  nodeId,
  prompt,
  metadata,
  createObjectUrl,
}: AiImageWidgetProps) {
  useGenerativeNodeCardHydrateById(nodeId);
  const { t } = useTranslation();
  const toast = useAppToast();
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const { configured: cloudConfigured, blocksGenerativeMedia } =
    useCloudStorageCanvasContext();
  const { updateNodeData } = useWorkflow();
  const initialLayout = useMemo(
    () => readNodeLayoutFromMetadata(metadata),
    [metadata]
  );
  const patchNodeLayout = useMemo(
    () =>
      updateNodeData
        ? createPatchNodeLayoutMetadata(nodeId, updateNodeData)
        : undefined,
    [nodeId, updateNodeData]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageZoomTriggerRef = useRef<HTMLButtonElement>(null);
  const openCreativeStudio = useOpenCreativeStudio(nodeId);
  const [uploading, setUploading] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const progressPhase = readGenerativeProgressPhase(metadata);
  const persistPhase = isGenerativePersistPhase(progressPhase)
    ? progressPhase
    : undefined;
  const coverImage = cardDisplay.coverMedia[0];
  const selectedHistoryItem =
    historyItems.items.find((item) => item.id === historyItems.selectedId) ??
    historyItems.items[0];
  const selectedFailed = hasFailedResource(selectedHistoryItem?.images);
  const isGenerating =
    (!selectedFailed && cardDisplay.isBusy) ||
    progressPhase === "cancelled";
  useGenerativeMediaWorkSession(
    uploading || (!selectedFailed && cardDisplay.isBusy)
  );
  const generateError = readGenerativeCardError(metadata);
  const hasImage = cardDisplay.hasCover;
  useGenerativeRecordErrorDisplay({
    orgId,
    nodeId,
    jobId: selectedFailed ? selectedHistoryItem?.jobId : undefined,
    modality: "image",
    enabled: selectedFailed && Boolean(selectedHistoryItem?.jobId),
    clearError:
      Boolean(selectedHistoryItem) &&
      hasDisplayableWorkflowMedia(selectedHistoryItem.images) &&
      !hasFailedResource(selectedHistoryItem.images) &&
      !hasGeneratingResource(selectedHistoryItem.images),
    updateNodeData,
  });
  const primaryImageExpired =
    coverImage && isMediaReference(coverImage)
      ? isMediaExpired(coverImage)
      : false;
  const primaryImageKey =
    coverImage && hasImage ? getResourceIdFromValue(coverImage) : null;
  const canDownloadPrimaryImage =
    Boolean(coverImage) && !primaryImageExpired && hasImage;
  const coverMediaRef =
    canDownloadPrimaryImage && coverImage ? coverImage : null;
  const { sharedUrlSet, fullDisplayUrl: imageDisplayUrl } =
    useGenerativeCardMediaDisplay({
      media: coverMediaRef,
      nodeType: "ai-image",
    });
  const { cardSize, onNaturalSize } = useCanvasCardSize({
    kind: "image",
    hasMedia: hasImage,
    mediaKey: primaryImageKey,
    holdSize: cardDisplay.isBusy,
    initialLayout,
  });
  const cardPhase = cardDisplay.cardPhase;
  const cardPlaceholder = formatGenerativePhaseLabel({
    phase: cardPhase,
    progressKey: generativeCardProgressKey(cardPhase, "image"),
    metadata,
    t,
  });
  const isPersistDownloading =
    persistPhase === "downloading" || progressPhase === "downloading";

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
          patchNodeLayout,
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
      <Suspense fallback={null}>
      <StudioImagePhotoProvider>
        {canDownloadPrimaryImage && coverImage && imageDisplayUrl ? (
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
          ) : hasImage && coverImage && !generateError ? (
            <CanvasMediaCover
              media={coverImage}
              nodeType="ai-image"
              cardWidthPx={cardSize.width}
              cardHeightPx={cardSize.height}
              fitMode="cover"
              className="h-full w-full rounded-none border-0"
              onNaturalSize={onNaturalSize}
              sharedUrlSet={sharedUrlSet}
            />
          ) : null}

          {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}

          {isPersistDownloading ? (
            <div className="nodrag nopan nowheel absolute inset-x-0 bottom-3 z-50 flex justify-center px-2">
              <GenerativeCloudAccelerationCardOffer nodeId={nodeId} />
            </div>
          ) : null}

          {!generateError && canDownloadPrimaryImage && coverImage ? (
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
      </Suspense>

      {generateError ? (
        <GenerativeCardErrorDetailDialog
          error={generateError}
          open={errorDetailOpen}
          onOpenChange={setErrorDetailOpen}
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
    cardDisplay: readAiImageCardDisplay(inputs, outputs, metadata),
    historyItems: readAiImageResultHistory(inputs),
    nodeId,
    prompt: readGenerativePrompt(inputs),
    metadata,
  }),
});
