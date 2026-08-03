import {
  AI_VIDEO_NODE_TYPE,
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
import type { MediaDisplaySize } from "@/services/media-display-size";
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
import { readGenerativeProgressPhase } from "../../generative-progress-utils";
import {
  isAiVideoGenerating,
  readAiVideoCardVideos,
  readAiVideoResultHistory,
  withAiVideoHistorySelection,
  withAiVideoGenerateError,
  withAiVideoManualUpload,
} from "../../ai-video-node-utils";
import { useExpandHistoryToSiblingNode } from "../../use-expand-history-to-sibling-node";
import { useAdaptiveMediaCardSize } from "@/hooks/use-adaptive-media-card-size";
import {
  GenerativeCardErrorBlock,
  GenerativeCardErrorDetailDialog,
} from "../../generative-card-error-block";
import { readGenerativeCardError } from "../../generative-card-error-utils";
import type { VideoFrameCaptureMode } from "../../capture-video-frame";
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
import { useVideoFrameToAiImageNode } from "../../use-video-frame-to-ai-image-node";
import { useWorkflow } from "../../workflow-context";
import { WorkflowMediaVideoPlayer } from "../../workflow-media-video-player";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface MediaVideoPreviewProps {
  readonly value: MediaReference;
  readonly createObjectUrl?: (ref: ObjectReference) => string;
  readonly className?: string;
  readonly size?: MediaDisplaySize;
  readonly nodeId: string;
  readonly disabled?: boolean;
}

function MediaVideoPreview({
  value,
  createObjectUrl,
  className,
  nodeId,
  disabled = false,
  size = "full",
}: MediaVideoPreviewProps) {
  const { t } = useTranslation();
  const expired = isMediaExpired(value);
  const { displayUrl, stale } = useMediaDisplayUrl({
    media: expired ? null : value,
    nodeType: "ai-video",
    size,
  });
  const [mediaError, setMediaError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { captureFrameToAiImageNode, isCapturing } =
    useVideoFrameToAiImageNode(nodeId);

  useEffect(() => {
    setMediaError(false);
  }, [displayUrl]);

  const handleFrameCapture = useCallback(
    (mode: VideoFrameCaptureMode) => {
      const video = videoRef.current;
      if (!video) return;
      void captureFrameToAiImageNode(video, mode);
    },
    [captureFrameToAiImageNode]
  );

  if (stale || !displayUrl || mediaError) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center rounded-none border-0 border-dashed border-neutral-300 bg-neutral-50 px-3 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400",
          className
        )}
      >
        {t("workflow.aiMediaCache.videoUnavailable")}
      </div>
    );
  }

  return (
    <WorkflowMediaVideoPlayer
      src={displayUrl}
      className={className}
      objectFit="contain"
      variant="card"
      showFrameCapture
      frameCaptureDisabled={disabled || isCapturing}
      videoRef={videoRef}
      onFrameCapture={handleFrameCapture}
      onError={() => setMediaError(true)}
    />
  );
}

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
    isAiVideoGenerating(metadata) || progressPhase !== undefined;
  useGenerativeMediaWorkSession(uploading || progressPhase !== undefined);
  const generateError = readGenerativeCardError(metadata);
  const cardPlaceholder = t(
    generativeCardProgressKey(
      progressPhase ??
        (isAiVideoGenerating(metadata) ? "generating" : null),
      "video"
    )
  );
  const activeVideo = videos[0];
  const activeVideoExpired = activeVideo ? isMediaExpired(activeVideo) : false;
  const { displayUrl: activeVideoUrl, stale: activeVideoStale } =
    useMediaDisplayUrl({
      media: activeVideo && !activeVideoExpired ? activeVideo : null,
      nodeType: "ai-video",
    });
  const canDownloadActiveVideo =
    Boolean(activeVideo) &&
    Boolean(activeVideoUrl) &&
    !activeVideoStale &&
    !activeVideoExpired;
  const cardSize = useAdaptiveMediaCardSize({
    displayUrl: activeVideoUrl,
    hasMedia: Boolean(activeVideo) && !activeVideoExpired && !activeVideoStale,
    kind: "video",
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
        modelDisplayName: item.modelDisplayName,
        createdAt: item.createdAt,
      });
    },
    [expandHistoryItem, historyItems.items]
  );

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (disabled || blocksGenerativeMedia || !files?.length || !updateNodeData || !orgId) return;

      const normalized = normalizeGenerativeCardUploadFile(files[0]!, "video");
      if (!normalized) {
        toast.error("workflow.fields.invalidVideoFile");
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
          mediaKind: "ai-video",
          nodeType: "ai-video",
        });

        const uploadError = resolveGenerativeCardUploadError({
          value,
          cloudConfigured,
          t,
        });

        updateNodeData(nodeId, (current) => {
          const withMedia = withAiVideoManualUpload(current, [value]);
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
        {!activeVideo && !generateError ? (
          <div className="flex h-full items-center justify-center px-3">
            <p className="text-center text-[11px] italic text-muted-foreground/50">
              {cardPlaceholder}
            </p>
          </div>
        ) : activeVideo ? (
          <MediaVideoPreview
            value={activeVideo}
            createObjectUrl={createObjectUrl}
            className="h-full w-full"
            nodeId={nodeId}
            disabled={disabled}
          />
        ) : null}

        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}

        {!generateError ? (
          <div className="nodrag nopan nowheel absolute right-2 top-2 z-50 flex items-center gap-1.5">
            {canDownloadActiveVideo && activeVideo && activeVideoUrl ? (
              <GenerativeMediaDownloadButton
                src={activeVideoUrl}
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
