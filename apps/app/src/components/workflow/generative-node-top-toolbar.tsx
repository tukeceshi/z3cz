import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  getResourceIdFromValue,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";
import DownloadIcon from "lucide-react/icons/download";
import HistoryIcon from "lucide-react/icons/history";
import Maximize2Icon from "lucide-react/icons/maximize-2";
import { useCallback, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ingestCanvasMedia } from "@/services/ingest-canvas-media";
import { isMediaExpired } from "@/services/media-url-resolver";
import { resolveResourceDisplayUrl } from "@/services/resolve-resource-display-url";

import {
  readAiAudioCardDisplay,
  readAiAudioResultHistory,
  withAiAudioHistorySelection,
} from "./ai-audio-node-utils";
import {
  readAiImageCardDisplay,
  readAiImageResultHistory,
  withAiImageHistorySelection,
} from "./ai-image-node-utils";
import {
  AiImageHistoryOverlay,
} from "./ai-image-history-overlay";
import {
  readAiTextResultHistory,
} from "./ai-text-node-utils";
import { commitAiTextHistorySelection } from "./commit-ai-text-value";
import {
  AiTextHistoryOverlay,
} from "./ai-text-history-overlay";
import {
  readAiVideoCardDisplay,
  readAiVideoResultHistory,
  withAiVideoHistorySelection,
} from "./ai-video-node-utils";
import {
  GENERATIVE_NODE_PANEL_TOOLBAR_BUTTON_CLASS,
  GENERATIVE_NODE_PANEL_TOOLBAR_DIVIDER_CLASS,
  GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS,
} from "./generative-card-styles";
import { commitGenerativeHistorySelection } from "./commit-generative-history-selection";
import { useOpenCreativeStudio } from "./creative-studio-context";
import { shouldShowGenerativeHistoryIcon } from "./generative-card-mode-utils";
import { readGenerativeCardError } from "./generative-card-error-utils";
import {
  canDownloadGenerativeText,
  downloadGenerativeTextContent,
} from "./generative-media-download-button";
import { GenerativeNodeTopToolbarShell } from "./generative-node-top-toolbar-shell";
import { useExpandHistoryToSiblingNode } from "./use-expand-history-to-sibling-node";
import {
  useGenerativeHistoryModels,
  useHistoryModelUnavailableToast,
} from "./use-generative-history-models";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

function TopToolbarDivider() {
  return (
    <div className={GENERATIVE_NODE_PANEL_TOOLBAR_DIVIDER_CLASS} aria-hidden />
  );
}

function TopToolbarButton({
  tooltip,
  disabled,
  onClick,
  children,
}: {
  readonly tooltip: ReactNode;
  readonly disabled?: boolean;
  readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={GENERATIVE_NODE_PANEL_TOOLBAR_BUTTON_CLASS}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export interface GenerativeNodeTopToolbarProps {
  readonly nodeId: string;
  readonly data: WorkflowNodeType;
  readonly zoom: number;
  readonly createObjectUrl: (objectReference: ObjectReference) => string;
}

export function GenerativeNodeTopToolbar({
  nodeId,
  data,
  zoom,
  createObjectUrl,
}: GenerativeNodeTopToolbarProps) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const orgId = organization?.id;
  const { id: workflowId } = useParams<{ id: string }>();
  const { updateNodeData, disabled = false } = useWorkflow();
  const openCreativeStudio = useOpenCreativeStudio(nodeId);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const historyModels = useGenerativeHistoryModels();
  const notifyHistoryModelUnavailable = useHistoryModelUnavailableToast();

  const nodeType = data.nodeType ?? "";
  const metadata = data.metadata;
  const generateError = readGenerativeCardError(metadata);

  const imageCardDisplay =
    nodeType === AI_IMAGE_NODE_TYPE
      ? readAiImageCardDisplay(data.inputs, data.outputs, metadata)
      : null;
  const videoCardDisplay =
    nodeType === AI_VIDEO_NODE_TYPE
      ? readAiVideoCardDisplay(data.inputs, data.outputs, metadata)
      : null;
  const audioCardDisplay =
    nodeType === AI_AUDIO_NODE_TYPE
      ? readAiAudioCardDisplay(data.inputs, data.outputs, metadata)
      : null;

  const imageHistory =
    nodeType === AI_IMAGE_NODE_TYPE ? readAiImageResultHistory(data.inputs) : null;
  const videoHistory =
    nodeType === AI_VIDEO_NODE_TYPE ? readAiVideoResultHistory(data.inputs) : null;
  const audioHistory =
    nodeType === AI_AUDIO_NODE_TYPE ? readAiAudioResultHistory(data.inputs) : null;
  const textHistory =
    nodeType === AI_TEXT_NODE_TYPE ? readAiTextResultHistory(data.inputs) : null;

  const historyCount =
    imageHistory?.items.length ??
    videoHistory?.items.length ??
    audioHistory?.items.length ??
    textHistory?.items.length ??
    0;

  const showHistory = shouldShowGenerativeHistoryIcon(historyCount, metadata);

  const coverMedia = useMemo((): MediaReference | null => {
    if (nodeType === AI_IMAGE_NODE_TYPE) {
      return imageCardDisplay?.coverMedia[0] ?? null;
    }
    if (nodeType === AI_VIDEO_NODE_TYPE) {
      return videoCardDisplay?.coverMedia[0] ?? null;
    }
    if (nodeType === AI_AUDIO_NODE_TYPE) {
      return audioCardDisplay?.coverMedia[0] ?? null;
    }
    return null;
  }, [audioCardDisplay, imageCardDisplay, nodeType, videoCardDisplay]);

  const hasMediaCover =
    nodeType === AI_IMAGE_NODE_TYPE
      ? Boolean(imageCardDisplay?.hasCover)
      : nodeType === AI_VIDEO_NODE_TYPE
        ? Boolean(videoCardDisplay?.hasCover)
        : nodeType === AI_AUDIO_NODE_TYPE
          ? Boolean(audioCardDisplay?.hasCover)
          : false;

  const mediaExpired = coverMedia ? isMediaExpired(coverMedia) : false;

  const canDownloadMedia =
    hasMediaCover && Boolean(coverMedia) && !mediaExpired;

  const canDownloadText =
    nodeType === AI_TEXT_NODE_TYPE && canDownloadGenerativeText(data);

  const canDownload = canDownloadMedia || canDownloadText;

  const downloadFileName = useMemo(() => {
    if (nodeType === AI_TEXT_NODE_TYPE) {
      return `text-${nodeId}.txt`;
    }
    if (!coverMedia) {
      return "download";
    }
    const resourceId = getResourceIdFromValue(coverMedia) ?? "media";
    if (nodeType === AI_AUDIO_NODE_TYPE) {
      return `audio-${resourceId}.mp3`;
    }
    if (nodeType === AI_VIDEO_NODE_TYPE) {
      return `video-${resourceId}.${coverMedia.mimeType.split("/")[1] ?? "mp4"}`;
    }
    return `image-${resourceId}.${coverMedia.mimeType?.split("/")[1] ?? "png"}`;
  }, [coverMedia, nodeId, nodeType]);

  const handleDownload = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (isDownloading || !canDownload || !orgId || !workflowId) {
        return;
      }

      setIsDownloading(true);
      try {
        if (nodeType === AI_TEXT_NODE_TYPE) {
          await downloadGenerativeTextContent({
            data,
            organizationId: orgId,
            workflowId,
            fileName: downloadFileName,
          });
          return;
        }

        if (!coverMedia) {
          return;
        }

        const mediaNodeType =
          nodeType === AI_VIDEO_NODE_TYPE
            ? "ai-video"
            : nodeType === AI_AUDIO_NODE_TYPE
              ? "ai-audio"
              : "ai-image";

        await ingestCanvasMedia({
          organizationId: orgId,
          workflowId,
          media: coverMedia,
          nodeType: mediaNodeType,
        });
        const src = await resolveResourceDisplayUrl({
          media: coverMedia,
          organizationId: orgId,
          workflowId,
          nodeType: mediaNodeType,
          size: "full",
        });
        if (!src) {
          throw new Error("Media not available locally");
        }
        const response = await fetch(src, { credentials: "include" });
        if (!response.ok) {
          throw new Error(`Download failed (${response.status})`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = downloadFileName;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Best-effort: user can retry after cache warm.
      } finally {
        setIsDownloading(false);
      }
    },
    [
      canDownload,
      coverMedia,
      data,
      downloadFileName,
      isDownloading,
      nodeType,
      orgId,
      workflowId,
    ]
  );

  const handleImageHistorySelect = useCallback(
    (id: string) => {
      if (disabled || !updateNodeData) return;
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
      historyModels.image,
      nodeId,
      notifyHistoryModelUnavailable,
      updateNodeData,
    ]
  );

  const handleVideoHistorySelect = useCallback(
    (id: string) => {
      if (disabled || !updateNodeData) return;
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
      historyModels.video,
      nodeId,
      notifyHistoryModelUnavailable,
      updateNodeData,
    ]
  );

  const handleAudioHistorySelect = useCallback(
    (id: string) => {
      if (disabled || !updateNodeData) return;
      let modelUnavailable = false;
      updateNodeData(nodeId, (current) => {
        const result = withAiAudioHistorySelection(current, id, {
          models: historyModels.audio,
        });
        const committed = commitGenerativeHistorySelection(result);
        modelUnavailable = committed.modelUnavailable;
        return committed.patch;
      });
      notifyHistoryModelUnavailable(modelUnavailable);
    },
    [
      disabled,
      historyModels.audio,
      nodeId,
      notifyHistoryModelUnavailable,
      updateNodeData,
    ]
  );

  const handleTextHistorySelect = useCallback(
    (id: string) => {
      if (disabled || !updateNodeData || !orgId || !workflowId) return;
      void commitAiTextHistorySelection({
        organizationId: orgId,
        workflowId,
        nodeId,
        selectedId: id,
        updateNodeData,
        current: data,
        models: historyModels.text,
      }).then((committed) => {
        notifyHistoryModelUnavailable(committed.modelUnavailable);
      });
    },
    [
      data,
      disabled,
      historyModels.text,
      nodeId,
      notifyHistoryModelUnavailable,
      orgId,
      updateNodeData,
      workflowId,
    ]
  );

  const expandImageHistory = useExpandHistoryToSiblingNode(nodeId, "image");
  const expandVideoHistory = useExpandHistoryToSiblingNode(nodeId, "video");
  const expandAudioHistory = useExpandHistoryToSiblingNode(nodeId, "audio");

  const handleImageHistoryExpand = useCallback(
    (id: string) => {
      const item = imageHistory?.items.find((entry) => entry.id === id);
      const media = item?.images[0];
      if (!item || !media) return;
      expandImageHistory({
        media,
        prompt: item.prompt,
        params: item.params,
        platformModelId: item.platformModelId,
        aiInterfaceId: item.aiInterfaceId,
        modelDisplayName: item.modelDisplayName,
        createdAt: item.createdAt,
      });
    },
    [expandImageHistory, imageHistory?.items]
  );

  const handleVideoHistoryExpand = useCallback(
    (id: string) => {
      const item = videoHistory?.items.find((entry) => entry.id === id);
      const media = item?.videos[0];
      if (!item || !media) return;
      expandVideoHistory({
        media,
        prompt: item.prompt,
        params: item.params,
        platformModelId: item.platformModelId,
        aiInterfaceId: item.aiInterfaceId,
        modelDisplayName: item.modelDisplayName,
        createdAt: item.createdAt,
      });
    },
    [expandVideoHistory, videoHistory?.items]
  );

  const handleAudioHistoryExpand = useCallback(
    (id: string) => {
      const item = audioHistory?.items.find((entry) => entry.id === id);
      const media = item?.audios[0];
      if (!item || !media) return;
      expandAudioHistory({
        media,
        prompt: item.prompt,
        params: item.params,
        platformModelId: item.platformModelId,
        aiInterfaceId: item.aiInterfaceId,
        modelDisplayName: item.modelDisplayName,
        createdAt: item.createdAt,
      });
    },
    [audioHistory?.items, expandAudioHistory]
  );

  if (generateError) {
    return null;
  }

  const selectedImageHistoryItem =
    imageHistory?.items.find((item) => item.id === imageHistory.selectedId) ??
    imageHistory?.items[0];
  const selectedVideoHistoryItem =
    videoHistory?.items.find((item) => item.id === videoHistory.selectedId) ??
    videoHistory?.items[0];
  const selectedAudioHistoryItem =
    audioHistory?.items.find((item) => item.id === audioHistory.selectedId) ??
    audioHistory?.items[0];

  const videoHistoryAsImageHistory = videoHistory
    ? {
        ...videoHistory,
        items: videoHistory.items.map((item) => ({
          ...item,
          images: item.videos,
        })),
      }
    : null;

  const audioHistoryAsImageHistory = audioHistory
    ? {
        ...audioHistory,
        items: audioHistory.items.map((item) => ({
          ...item,
          images: item.audios,
        })),
      }
    : null;

  return (
    <>
      <GenerativeNodeTopToolbarShell zoom={zoom}>
        {showHistory ? (
          <>
            <TopToolbarButton
              tooltip={t("workflow.aiImagePanel.historyTitle")}
              onClick={(event) => {
                event.stopPropagation();
                setHistoryOpen(true);
              }}
            >
              <HistoryIcon
                className={GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS}
                strokeWidth={2}
              />
              <span className="tabular-nums">{historyCount}</span>
              <span>{t("workflow.aiImagePanel.historyTitle")}</span>
            </TopToolbarButton>
            <TopToolbarDivider />
          </>
        ) : null}

        <TopToolbarButton
          tooltip={t("workflow.studio.download")}
          disabled={!canDownload || isDownloading}
          onClick={handleDownload}
        >
          <DownloadIcon
            className={GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS}
            strokeWidth={2}
          />
        </TopToolbarButton>

        <TopToolbarButton
          tooltip={t("workflow.studio.enter")}
          onClick={(event) => {
            event.stopPropagation();
            openCreativeStudio();
          }}
        >
          <Maximize2Icon
            className={GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS}
            strokeWidth={2}
          />
        </TopToolbarButton>
      </GenerativeNodeTopToolbarShell>

      {showHistory && imageHistory ? (
        <AiImageHistoryOverlay
          open={historyOpen}
          history={imageHistory}
          currentImages={
            selectedImageHistoryItem?.images.length
              ? [...selectedImageHistoryItem.images]
              : coverMedia
                ? [coverMedia]
                : []
          }
          onClose={() => setHistoryOpen(false)}
          onSelect={handleImageHistorySelect}
          onExpandToNode={handleImageHistoryExpand}
        />
      ) : null}

      {showHistory && videoHistoryAsImageHistory ? (
        <AiImageHistoryOverlay
          open={historyOpen}
          history={videoHistoryAsImageHistory}
          currentImages={
            selectedVideoHistoryItem?.videos.length
              ? [...selectedVideoHistoryItem.videos]
              : coverMedia
                ? [coverMedia]
                : []
          }
          mediaKind="video"
          createObjectUrl={createObjectUrl}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleVideoHistorySelect}
          onExpandToNode={handleVideoHistoryExpand}
        />
      ) : null}

      {showHistory && audioHistoryAsImageHistory ? (
        <AiImageHistoryOverlay
          open={historyOpen}
          history={audioHistoryAsImageHistory}
          currentImages={
            selectedAudioHistoryItem?.audios.length
              ? [...selectedAudioHistoryItem.audios]
              : coverMedia
                ? [coverMedia]
                : []
          }
          mediaKind="audio"
          onClose={() => setHistoryOpen(false)}
          onSelect={handleAudioHistorySelect}
          onExpandToNode={handleAudioHistoryExpand}
        />
      ) : null}

      {showHistory && textHistory ? (
        <AiTextHistoryOverlay
          open={historyOpen}
          history={textHistory}
          currentId={textHistory.selectedId}
          organizationId={orgId}
          workflowId={workflowId}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleTextHistorySelect}
        />
      ) : null}
    </>
  );
}
