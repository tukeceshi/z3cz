import {
  AI_VIDEO_NODE_TYPE,
  getResourceIdFromValue,
  hasDisplayableWorkflowMedia,
  hasFailedResource,
  hasGeneratingResource,
  type MediaReference,
  type ObjectReference,
  readNodeLayoutFromMetadata,
} from "@dafthunk/types";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "react-router";

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
import { isMediaExpired } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import { useOpenCreativeStudio } from "../../creative-studio-context";
import { GenerativeCloudAccelerationCardOffer } from "../../generative-cloud-acceleration-card-offer";
import type { GenerativeCardCoverRead } from "../../generative-history-utils";
import { useGenerativeVideoFileUpload } from "../../use-generative-video-file-upload";
import {
  isGenerativePersistPhase,
  isGenerativeProgressBusyPhase,
  readGenerativeProgressPhase,
} from "../../generative-progress-utils";
import {
  isAiVideoGenerating,
  readAiVideoCardDisplay,
  readAiVideoResultHistory,
} from "../../ai-video-node-utils";
import {
  GenerativeCardErrorBlock,
  GenerativeCardErrorDetailDialog,
} from "../../generative-card-error-block";
import { GenerativeCardNoticeBlock } from "../../generative-card-notice-block";
import {
  dismissGenerativeCancelledNotice,
  isGenerativeCancelledNoticeVisible,
  subscribeGenerativeCancelledNotice,
} from "../../generative-generation-cancel";
import { prepareGenerativeCardError } from "../../prepare-generative-card-error";
import { readGenerativeCardError } from "../../generative-card-error-utils";
import {
  normalizeGenerativeCardUploadFile,
  readGenerativePrompt,
  withGenerativePromptCleared,
} from "../../generative-card-upload-utils";
import { createPatchNodeLayoutMetadata } from "../../patch-node-layout-metadata";
import { GenerativeCardEmptyUploadSlot } from "../../generative-card-empty-upload-slot";
import { useGenerativeCardUpload } from "../../use-generative-card-upload";
import { useWorkflow } from "../../workflow-context";
import { useGenerativeNodeCardHydrateById } from "../../use-generative-node-card-hydrate";
import { CanvasMediaCover } from "../../canvas-media-cover";
import { StudioVideoLightbox } from "../../studio-video-lightbox";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiVideoWidgetProps extends BaseWidgetProps {
  cardDisplay: GenerativeCardCoverRead<MediaReference>;
  historyItems: ReturnType<typeof readAiVideoResultHistory>;
  nodeId: string;
  prompt: string;
  metadata?: Record<string, string>;
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

function AiVideoWidget({
  cardDisplay,
  historyItems,
  disabled = false,
  className,
  nodeId,
  prompt,
  metadata,
  createObjectUrl,
}: AiVideoWidgetProps) {
  useGenerativeNodeCardHydrateById(nodeId);
  const { t } = useTranslation();
  const toast = useAppToast();
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id;
  const { blocksGenerativeMedia } = useCloudStorageCanvasContext();
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
  const { uploadVideoFileToNode } = useGenerativeVideoFileUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openCreativeStudio = useOpenCreativeStudio(nodeId);
  const [videoLightboxOpen, setVideoLightboxOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const progressPhase = readGenerativeProgressPhase(metadata);
  const persistPhase = isGenerativePersistPhase(progressPhase)
    ? progressPhase
    : undefined;
  const selectedHistoryItem =
    historyItems.items.find((item) => item.id === historyItems.selectedId) ??
    historyItems.items[0];
  const historyFailed = hasFailedResource(selectedHistoryItem?.videos);
  const metadataBusy =
    isAiVideoGenerating(metadata) ||
    isGenerativeProgressBusyPhase(progressPhase);
  const selectedFailed =
    historyFailed ||
    (Boolean(selectedHistoryItem?.jobId) &&
      (selectedHistoryItem?.videos.length ?? 0) === 0 &&
      !metadataBusy);
  const restoredError = useGenerativeRecordErrorDisplay({
    orgId,
    nodeId,
    jobId: selectedFailed ? selectedHistoryItem?.jobId : undefined,
    modality: "video",
    enabled: selectedFailed,
    clearError: Boolean(
      selectedHistoryItem &&
        hasDisplayableWorkflowMedia(selectedHistoryItem.videos) &&
        !hasFailedResource(selectedHistoryItem.videos) &&
        !hasGeneratingResource(selectedHistoryItem.videos)
    ),
    updateNodeData,
  });
  const fallbackFailedError = useMemo(
    () =>
      historyFailed
        ? prepareGenerativeCardError(
            t("workflow.generativeErrors.generationFailed"),
            t,
            "video"
          )
        : undefined,
    [historyFailed, t]
  );
  const generateError =
    readGenerativeCardError(metadata) ?? restoredError ?? fallbackFailedError;
  const isGenerating =
    (!historyFailed && !generateError && cardDisplay.isBusy) ||
    progressPhase === "cancelled";
  useGenerativeMediaWorkSession(
    uploading || (!historyFailed && !generateError && cardDisplay.isBusy)
  );
  const showCancelledNotice = useSyncExternalStore(
    subscribeGenerativeCancelledNotice,
    () => isGenerativeCancelledNoticeVisible(nodeId),
    () => false
  );
  const handleDismissCancelledNotice = useCallback(() => {
    dismissGenerativeCancelledNotice(nodeId);
  }, [nodeId]);
  const cardPhase = cardDisplay.cardPhase;
  const cardPlaceholder = formatGenerativePhaseLabel({
    phase: cardPhase,
    progressKey: generativeCardProgressKey(cardPhase, "video"),
    metadata,
    t,
  });
  const isPersistDownloading =
    persistPhase === "downloading" || progressPhase === "downloading";
  const coverVideo = cardDisplay.coverMedia[0];
  const hasVideo = cardDisplay.hasCover;
  const activeVideoExpired = hasVideo && coverVideo ? isMediaExpired(coverVideo) : false;
  const activeVideoKey = hasVideo && coverVideo ? getResourceIdFromValue(coverVideo) : null;
  const coverMediaRef =
    hasVideo && !activeVideoExpired && coverVideo ? coverVideo : null;
  const { sharedUrlSet, fullDisplayUrl: videoDisplayUrl } =
    useGenerativeCardMediaDisplay({
      media: coverMediaRef,
      nodeType: "ai-video",
    });
  const { cardSize, onNaturalSize } = useCanvasCardSize({
    kind: "video",
    hasMedia: hasVideo,
    mediaKey: activeVideoKey,
    holdSize: cardDisplay.isBusy,
    initialLayout,
  });

  const handleClearPrompt = useCallback(() => {
    if (!updateNodeData) return;
    updateNodeData(nodeId, (current) => ({
      inputs: withGenerativePromptCleared(current.inputs),
    }));
  }, [nodeId, updateNodeData]);

  const handleOpenVideoLightbox = useCallback(() => {
    if (!videoDisplayUrl) return;
    setVideoLightboxOpen(true);
  }, [videoDisplayUrl]);

  const isUploadBlocked = disabled || blocksGenerativeMedia;

  const { canUpload, handleUploadClick, uploadConfirmDialog } =
    useGenerativeCardUpload({
      prompt,
      hasMedia: hasVideo,
      isGenerating,
      disabled,
      blocksGenerativeMedia,
      uploading,
      fileInputRef,
      onClearPrompt: handleClearPrompt,
      i18nPrefix: "workflow.aiVideoPanel",
    });

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (disabled || blocksGenerativeMedia || !files?.length || !updateNodeData || !orgId || !workflowId) return;

      const normalized = normalizeGenerativeCardUploadFile(files[0]!, "video");
      if (!normalized) {
        toast.error("workflow.fields.invalidVideoFile");
        return;
      }

      setUploading(true);
      try {
        await uploadVideoFileToNode({
          nodeId,
          file: normalized,
          patchNodeLayout,
        });
      } finally {
        setUploading(false);
      }
    },
    [
      blocksGenerativeMedia,
      disabled,
      nodeId,
      patchNodeLayout,
      toast,
      updateNodeData,
      uploadVideoFileToNode,
      workflowId,
    ]
  );

  return (
    <>
      {uploadConfirmDialog}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
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
          if (showCancelledNotice) {
            event.stopPropagation();
            return;
          }
          if (!isGenerating) {
            event.stopPropagation();
            openCreativeStudio();
          }
        }}
      >
        {!hasVideo && !generateError && !showCancelledNotice ? (
          <GenerativeCardEmptyUploadSlot
            kind="video"
            size="canvas"
            doubleClickHintKey="workflow.studio.cardDoubleClickOpenStudio"
            busy={isGenerating || uploading || isGenerativeProgressBusyPhase(progressPhase)}
            busyMessage={cardPlaceholder}
            canUpload={canUpload}
            onUploadClick={handleUploadClick}
          />
        ) : hasVideo && coverVideo ? (
          <CanvasMediaCover
            media={coverVideo}
            nodeType="ai-video"
            nodeId={nodeId}
            cardWidthPx={cardSize.width}
            cardHeightPx={cardSize.height}
            fitMode="cover"
            className="h-full w-full rounded-none border-0"
            onNaturalSize={onNaturalSize}
            onExpandView={
              videoDisplayUrl ? handleOpenVideoLightbox : undefined
            }
            sharedUrlSet={sharedUrlSet}
          />
        ) : null}

        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}

        {isPersistDownloading ? (
          <div className="nodrag nopan nowheel absolute inset-x-0 bottom-3 z-50 flex justify-center px-2">
            <GenerativeCloudAccelerationCardOffer nodeId={nodeId} />
          </div>
        ) : null}

        {showCancelledNotice && !generateError ? (
          <GenerativeCardNoticeBlock
            message={t("workflow.generativeCancel.success")}
            dismissLabel={t("workflow.generativeCancel.dismiss")}
            onDismiss={handleDismissCancelledNotice}
          />
        ) : null}
      </div>

      {generateError ? (
        <GenerativeCardErrorDetailDialog
          error={generateError}
          open={errorDetailOpen}
          onOpenChange={setErrorDetailOpen}
        />
      ) : null}

      {videoDisplayUrl ? (
        <StudioVideoLightbox
          open={videoLightboxOpen}
          src={videoDisplayUrl}
          nodeId={nodeId}
          onClose={() => setVideoLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}

export const aiVideoWidget = createWidget({
  component: AiVideoWidget,
  nodeTypes: [AI_VIDEO_NODE_TYPE],
  inputField: "prompt",
  managedFields: [
    "model",
    "prompt",
    "params",
    "manual_videos",
    "videos_result",
    "videos_history",
    "reference_images",
    "ai_interface_id",
  ],
  extractConfig: (nodeId, inputs, outputs, metadata) => ({
    cardDisplay: readAiVideoCardDisplay(inputs, outputs, metadata),
    historyItems: readAiVideoResultHistory(inputs),
    nodeId,
    prompt: readGenerativePrompt(inputs),
    metadata,
  }),
});
