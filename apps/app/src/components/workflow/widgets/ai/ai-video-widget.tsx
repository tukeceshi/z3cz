import {
  AI_VIDEO_NODE_TYPE,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { useObjectService } from "@/services/object-service";
import type { MediaDisplaySize } from "@/services/media-display-size";
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
import {
  AI_VIDEO_CARD_HEIGHT_PX,
  AI_VIDEO_CARD_WIDTH_PX,
  isAiVideoGenerating,
  readAiVideoCardVideos,
  readAiVideoResultHistory,
  withAiVideoHistorySelection,
  withAiVideoManualUpload,
} from "../../ai-video-node-utils";
import type { VideoFrameCaptureMode } from "../../capture-video-frame";
import {
  shouldShowGenerativeHistoryIcon,
  withGenerativeCardEditing,
} from "../../generative-card-mode-utils";
import {
  readGenerativePrompt,
  withGenerativePromptCleared,
} from "../../generative-card-upload-utils";
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
    createObjectUrl,
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
        {t("workflow.aiMediaCache.imageUnavailable")}
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
  const { updateNodeData } = useWorkflow();
  const { uploadBinaryData } = useObjectService();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandOpen, setExpandOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const cardPlaceholder = t("workflow.aiVideoPanel.cardUploadPlaceholder");
  const activeVideo = videos[0];

  const handleClearPrompt = useCallback(() => {
    if (!updateNodeData) return;
    updateNodeData(nodeId, (current) => ({
      inputs: withGenerativePromptCleared(current.inputs),
    }));
  }, [nodeId, updateNodeData]);

  const { handleCardDoubleClick, uploadConfirmDialog } =
    useGenerativeCardDoubleClickUpload({
      prompt,
      hasMedia: Boolean(activeVideo),
      isGenerating: isAiVideoGenerating(metadata),
      disabled,
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

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (disabled || !files?.length || !updateNodeData) return;

      const file = files[0];
      if (!file.type.startsWith("video/")) {
        return;
      }

      setUploading(true);
      setCardEditing(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const mimeType = file.type || "application/octet-stream";
        const value = (await uploadBinaryData(
          arrayBuffer,
          mimeType
        )) as ObjectReference;

        updateNodeData(nodeId, (current) =>
          withAiVideoManualUpload(current, [value])
        );
      } finally {
        setUploading(false);
        setCardEditing(false);
      }
    },
    [disabled, nodeId, setCardEditing, updateNodeData, uploadBinaryData]
  );

  const historyAsImageHistory = {
    items: historyItems.items.map((item) => ({
      id: item.id,
      images: item.videos,
      prompt: item.prompt,
      params: item.params,
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
          width: AI_VIDEO_CARD_WIDTH_PX,
          height: AI_VIDEO_CARD_HEIGHT_PX,
        }}
        onDoubleClick={handleCardDoubleClick}
      >
        {!activeVideo ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[11px] text-muted-foreground/50 italic">
              {cardPlaceholder}
            </p>
          </div>
        ) : (
          <MediaVideoPreview
            value={activeVideo}
            createObjectUrl={createObjectUrl}
            className="h-full w-full"
            nodeId={nodeId}
            disabled={disabled}
          />
        )}

        <div className="nodrag nopan nowheel absolute right-2 top-2 z-50 flex items-center gap-1.5">
          {showHistoryIcon ? (
            <AiImageHistoryButton
              count={historyItems.items.length}
              onClick={() => setHistoryOpen(true)}
            />
          ) : null}
          {activeVideo ? (
            <AiImageExpandButton onClick={() => setExpandOpen(true)} />
          ) : null}
        </div>
      </div>

      {activeVideo ? (
        <AiImageExpandOverlay
          open={expandOpen}
          title={t("workflow.aiVideoPanel.outputTitle")}
          media={[activeVideo]}
          createObjectUrl={createObjectUrl}
          onClose={() => setExpandOpen(false)}
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
