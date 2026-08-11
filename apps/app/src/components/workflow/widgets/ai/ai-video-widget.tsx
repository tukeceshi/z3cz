import {
  AI_VIDEO_NODE_TYPE,
  getMediaReferenceKey,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "react-router";

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
import { isGenerativeProgressBusyPhase, readGenerativeProgressPhase, withGenerativeUploadProgress } from "../../generative-progress-utils";
import {
  isAiVideoGenerating,
  readAiVideoCardPrimaryVideo,
  readAiVideoResultHistory,
  withAiVideoHistorySelection,
  withAiVideoGenerateError,
  withAiVideoManualUpload,
} from "../../ai-video-node-utils";
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
import { GenerativeCardNoticeBlock } from "../../generative-card-notice-block";
import {
  dismissGenerativeCancelledNotice,
  isGenerativeCancelledNoticeVisible,
  subscribeGenerativeCancelledNotice,
} from "../../generative-generation-cancel";
import { readGenerativeCardError } from "../../generative-card-error-utils";
import {
  shouldShowGenerativeHistoryIcon,
} from "../../generative-card-mode-utils";
import {
  normalizeGenerativeCardUploadFile,
  readGenerativePrompt,
  resolveGenerativeCardUploadError,
  withGenerativePromptCleared,
} from "../../generative-card-upload-utils";
import { prepareGenerativeCardError } from "../../prepare-generative-card-error";
import { GenerativeMediaLazyDownloadButton, GENERATIVE_CARD_OVERLAY_BUTTON_CLASSNAME } from "../../generative-media-download-button";
import { GenerativeCardEmptyUploadSlot } from "../../generative-card-empty-upload-slot";
import { useGenerativeCardUpload } from "../../use-generative-card-upload";
import { useWorkflow } from "../../workflow-context";
import { CanvasMediaCover } from "../../canvas-media-cover";
import { StudioVideoLightbox } from "../../studio-video-lightbox";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiVideoWidgetProps extends BaseWidgetProps {
  primaryVideo: MediaReference | undefined;
  historyItems: ReturnType<typeof readAiVideoResultHistory>;
  nodeId: string;
  prompt: string;
  metadata?: Record<string, string>;
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

function AiVideoWidget({
  primaryVideo,
  historyItems,
  disabled = false,
  className,
  nodeId,
  prompt,
  metadata,
  createObjectUrl,
}: AiVideoWidgetProps) {
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
  const [videoLightboxOpen, setVideoLightboxOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const progressPhase = readGenerativeProgressPhase(metadata);
  const isGenerating =
    isAiVideoGenerating(metadata) || isGenerativeProgressBusyPhase(progressPhase);
  useGenerativeMediaWorkSession(
    uploading || isGenerativeProgressBusyPhase(progressPhase)
  );
  const generateError = readGenerativeCardError(metadata);
  const showCancelledNotice = useSyncExternalStore(
    subscribeGenerativeCancelledNotice,
    () => isGenerativeCancelledNoticeVisible(nodeId),
    () => false
  );
  const handleDismissCancelledNotice = useCallback(() => {
    dismissGenerativeCancelledNotice(nodeId);
  }, [nodeId]);
  const cardPlaceholder = t(
    generativeCardProgressKey(
      progressPhase ??
        (isAiVideoGenerating(metadata) ? "generating" : null),
      "video"
    )
  );
  const activeVideo = primaryVideo;
  const activeVideoExpired = activeVideo ? isMediaExpired(activeVideo) : false;
  const activeVideoKey = activeVideo ? getMediaReferenceKey(activeVideo) : null;
  const { displayUrl: videoDisplayUrl } = useMediaDisplayUrl({
    media: activeVideo && !activeVideoExpired ? activeVideo : null,
    nodeType: "ai-video",
    size: "full",
    localOnly: true,
  });
  const canDownloadActiveVideo = Boolean(activeVideo) && !activeVideoExpired;
  const { cardSize, onNaturalSize } = useCanvasCardSize({
    kind: "video",
    hasMedia: activeVideo != null,
    mediaKey: activeVideoKey,
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
      hasMedia: Boolean(activeVideo),
      isGenerating,
      disabled,
      blocksGenerativeMedia,
      uploading,
      fileInputRef,
      onClearPrompt: handleClearPrompt,
      i18nPrefix: "workflow.aiVideoPanel",
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
        const result = withAiVideoHistorySelection(current, id, {
          models: historyModels.video,
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
      historyModels.video,
      nodeId,
      notifyHistoryModelUnavailable,
      updateNodeData,
    ]
  );

  const expandHistoryItem = useExpandHistoryToSiblingNode(nodeId, "video");

  const handleHistoryExpand = useCallback(
    (id: string) => {
      const item = historyItems.items.find((entry) => entry.id === id);
      const media = item?.videos[0];
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

      const normalized = normalizeGenerativeCardUploadFile(files[0]!, "video");
      if (!normalized) {
        toast.error("workflow.fields.invalidVideoFile");
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
          mediaKind: "ai-video",
          nodeType: "ai-video",
        });

        warmCardUploadPersist({
          organizationId: orgId,
          workflowId,
          staged,
          nodeType: "ai-video",
          cloudConfigured,
        });

        const uploadError = resolveGenerativeCardUploadError({
          value: staged,
          cloudConfigured,
          t,
        });

        updateNodeData(nodeId, (current) => {
          const withMedia = withAiVideoManualUpload(current, [staged]);
          return {
            ...withMedia,
            metadata: withGenerativeUploadProgress(
              withAiVideoGenerateError(withMedia.metadata, uploadError),
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
          "video"
        );
        updateNodeData(nodeId, (current) => ({
          metadata: withGenerativeUploadProgress(
            withAiVideoGenerateError(current.metadata, formatted),
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
      blocksGenerativeMedia,
      cloudConfigured,
      disabled,
      nodeId,
      orgId,
      t,
      toast,
      updateNodeData,
      workflowId,
    ]
  );

  const historyAsImageHistory = {
    items: historyItems.items.map((item) => ({
      id: item.id,
      images: item.videos,
      prompt: item.prompt,
      params: item.params,
      platformModelId: item.platformModelId,
      providerModelId: item.providerModelId,
      modelDisplayName: item.modelDisplayName,
      createdAt: item.createdAt,
    })),
    selectedId: historyItems.selectedId,
  };

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
        {!activeVideo && !generateError && !showCancelledNotice ? (
          <GenerativeCardEmptyUploadSlot
            kind="video"
            size="canvas"
            doubleClickHintKey="workflow.studio.cardDoubleClickOpenStudio"
            busy={isGenerating || uploading}
            busyMessage={cardPlaceholder}
            canUpload={canUpload}
            onUploadClick={handleUploadClick}
          />
        ) : activeVideo ? (
          <CanvasMediaCover
            media={activeVideo}
            nodeType="ai-video"
            cardWidthPx={cardSize.width}
            cardHeightPx={cardSize.height}
            fitMode="cover"
            className="h-full w-full rounded-none border-0"
            onNaturalSize={onNaturalSize}
            onExpandView={
              videoDisplayUrl ? handleOpenVideoLightbox : undefined
            }
          />
        ) : null}

        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}

        {showCancelledNotice && !generateError ? (
          <GenerativeCardNoticeBlock
            message={t("workflow.generativeCancel.success")}
            dismissLabel={t("workflow.generativeCancel.dismiss")}
            onDismiss={handleDismissCancelledNotice}
          />
        ) : null}

        {!generateError && !showCancelledNotice ? (
          <div className="nodrag nopan nowheel absolute right-2 top-2 z-50 flex items-center gap-1.5">
            {canDownloadActiveVideo && activeVideo ? (
              <GenerativeMediaLazyDownloadButton
                media={activeVideo}
                nodeType="ai-video"
                fileName={`video-${getMediaReferenceKey(activeVideo)}.${activeVideo.mimeType.split("/")[1] ?? "mp4"}`}
                className={GENERATIVE_CARD_OVERLAY_BUTTON_CLASSNAME}
              />
            ) : null}
            {showHistoryIcon ? (
              <AiImageHistoryButton
                count={historyItems.items.length}
                onClick={() => setHistoryOpen(true)}
              />
            ) : null}
            {activeVideo ? (
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
          history={historyAsImageHistory}
          currentImages={activeVideo ? [activeVideo] : []}
          mediaKind="video"
          createObjectUrl={createObjectUrl}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
          onExpandToNode={handleHistoryExpand}
        />
      ) : null}
      {videoDisplayUrl ? (
        <StudioVideoLightbox
          open={videoLightboxOpen}
          src={videoDisplayUrl}
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
    primaryVideo: readAiVideoCardPrimaryVideo(inputs, outputs, metadata),
    historyItems: readAiVideoResultHistory(inputs),
    nodeId,
    prompt: readGenerativePrompt(inputs),
    metadata,
  }),
});
