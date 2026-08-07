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
import { isGenerativeProgressBusyPhase, readGenerativeProgressPhase } from "../../generative-progress-utils";
import {
  isAiVideoGenerating,
  readAiVideoCardVideos,
  readAiVideoResultHistory,
  withAiVideoHistorySelection,
  withAiVideoGenerateError,
  withAiVideoManualUpload,
} from "../../ai-video-node-utils";
import { useExpandHistoryToSiblingNode } from "../../use-expand-history-to-sibling-node";
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
import { GENERATIVE_CARD_STATE_LABEL_CLASS } from "../../generative-card-styles";
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
import { GenerativeMediaLazyDownloadButton, GENERATIVE_CARD_OVERLAY_BUTTON_CLASSNAME } from "../../generative-media-download-button";
import { useGenerativeCardDoubleClickUpload } from "../../use-generative-card-double-click-upload";
import { useWorkflow } from "../../workflow-context";
import { CanvasMediaCover } from "../../canvas-media-cover";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiVideoWidgetProps extends BaseWidgetProps {
  videos: MediaReference[];
  historyItems: ReturnType<typeof readAiVideoResultHistory>;
  nodeId: string;
  prompt: string;
  metadata?: Record<string, string>;
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

function AiVideoWidget({
  videos,
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
  const activeVideo = videos[0];
  const activeVideoExpired = activeVideo ? isMediaExpired(activeVideo) : false;
  const activeVideoKey = activeVideo ? getMediaReferenceKey(activeVideo) : null;
  const canDownloadActiveVideo = Boolean(activeVideo) && !activeVideoExpired;
  const { cardSize, onNaturalSize } = useCanvasCardSize({
    kind: "video",
    hasMedia: videos.length > 0,
    mediaKey: activeVideoKey,
  });

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
      hasMedia: Boolean(activeVideo),
      isGenerating,
      disabled,
      blocksGenerativeMedia,
      uploading,
      fileInputRef,
      onClearPrompt: handleClearPrompt,
      i18nPrefix: "workflow.aiVideoPanel",
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
        withAiVideoHistorySelection(current, id)
      );
    },
    [disabled, historyItems.items, nodeId, updateNodeData]
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
      setCardEditing(true);
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
            metadata: withAiVideoGenerateError(
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
          metadata: withAiVideoGenerateError(current.metadata, formatted),
        }));
        toast.errorRaw(formatted.summary);
      } finally {
        setUploading(false);
        setCardEditing(false);
      }
    },
    [
      blocksGenerativeMedia,
      cloudConfigured,
      disabled,
      nodeId,
      orgId,
      setCardEditing,
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
          if (activeVideo && !isGenerating) {
            event.stopPropagation();
            openCreativeStudio();
            return;
          }
          if (!isGenerating) {
            handleCardDoubleClick(event);
          }
        }}
      >
        {!activeVideo && !generateError && !showCancelledNotice ? (
          <div className="flex h-full items-center justify-center px-3">
            <p className={GENERATIVE_CARD_STATE_LABEL_CLASS}>
              {cardPlaceholder}
            </p>
          </div>
        ) : activeVideo ? (
          <CanvasMediaCover
            media={activeVideo}
            nodeType="ai-video"
            cardWidthPx={cardSize.width}
            cardHeightPx={cardSize.height}
            fitMode="cover"
            className="h-full w-full rounded-none border-0"
            onNaturalSize={onNaturalSize}
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
          currentImages={videos}
          mediaKind="video"
          createObjectUrl={createObjectUrl}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
          onExpandToNode={handleHistoryExpand}
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
    videos: readAiVideoCardVideos(inputs, outputs, metadata),
    historyItems: readAiVideoResultHistory(inputs),
    nodeId,
    prompt: readGenerativePrompt(inputs),
    metadata,
  }),
});
