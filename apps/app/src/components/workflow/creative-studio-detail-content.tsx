import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  getMediaReferenceKey,
  type MediaReference,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Textarea } from "@/components/ui/textarea";
import { useAppToast } from "@/hooks/use-app-toast";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { stageGenerativeCardUpload } from "@/services/stage-generative-media";
import { isMediaExpired } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import {
  AiTextHistoryOverlay,
} from "./ai-text-history-overlay";
import {
  AI_TEXT_HARD_OUTPUT_MAX_CHARS,
  hasAiTextGeneratedHistory,
  isAiTextGenerating,
  readAiTextResult,
  readAiTextResultHistory,
  withAiTextEditedResult,
  withAiTextHistorySelection,
  withAiTextManualResult,
} from "./ai-text-node-utils";
import {
  AiImageHistoryOverlay,
} from "./ai-image-history-overlay";
import { useExpandHistoryToSiblingNode } from "./use-expand-history-to-sibling-node";
import {
  isAiImageGenerating,
  readAiImageCardImages,
  readAiImageResultHistory,
  withAiImageGenerateError,
  withAiImageHistorySelection,
  withAiImageManualUpload,
} from "./ai-image-node-utils";
import {
  isAiVideoGenerating,
  readAiVideoCardVideos,
  readAiVideoResultHistory,
  withAiVideoGenerateError,
  withAiVideoHistorySelection,
  withAiVideoManualUpload,
} from "./ai-video-node-utils";
import {
  isAiAudioGenerating,
  readAiAudioCardAudios,
  readAiAudioResultHistory,
  withAiAudioGenerateError,
  withAiAudioHistorySelection,
  withAiAudioManualUpload,
} from "./ai-audio-node-utils";
import {
  GenerativeCardErrorBlock,
  GenerativeCardErrorDetailDialog,
} from "./generative-card-error-block";
import { readGenerativeCardError } from "./generative-card-error-utils";
import {
  shouldShowGenerativeHistoryIcon,
  withGenerativeCardEditing,
} from "./generative-card-mode-utils";
import {
  normalizeGenerativeCardUploadFile,
  readGenerativePrompt,
  resolveGenerativeCardUploadError,
  withGenerativePromptCleared,
  GENERATIVE_IMAGE_UPLOAD_ACCEPT,
} from "./generative-card-upload-utils";
import { prepareGenerativeCardError } from "./prepare-generative-card-error";
import {
  StudioDownloadActionButton,
  StudioHistoryActionButton,
} from "./creative-studio-detail-actions";
import { CreativeStudioNodePreview } from "./creative-studio-node-preview";
import { STUDIO_SCROLL } from "./creative-studio-surface";
import { useBufferedTextValue } from "./use-buffered-text-value";
import { useGenerativeCardDoubleClickUpload } from "./use-generative-card-double-click-upload";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioDetailContentProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
}

export function CreativeStudioDetailContent({
  node,
}: CreativeStudioDetailContentProps) {
  const nodeType = node.data.nodeType ?? "";

  if (nodeType === AI_TEXT_NODE_TYPE) {
    return <StudioTextDetail node={node} />;
  }
  if (nodeType === AI_IMAGE_NODE_TYPE) {
    return <StudioImageDetail node={node} />;
  }
  if (nodeType === AI_VIDEO_NODE_TYPE) {
    return <StudioVideoDetail node={node} />;
  }
  if (nodeType === AI_AUDIO_NODE_TYPE) {
    return <StudioAudioDetail node={node} />;
  }

  return (
    <CreativeStudioNodePreview
      nodeId={node.id}
      data={node.data}
      variant="detail"
      className="h-full"
    />
  );
}

function StudioToolbar({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5">
      <div className="pointer-events-auto flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function StudioTextDetail({
  node,
}: {
  readonly node: ReactFlowNode<WorkflowNodeType>;
}) {
  const { t } = useTranslation();
  const { updateNodeData, disabled = false } = useWorkflow();
  const nodeId = node.id;
  const metadata = node.data.metadata;
  const text = readAiTextResult(node.data.inputs, node.data.outputs) ?? "";
  const historyItems = readAiTextResultHistory(node.data.inputs);
  const isGenerating = isAiTextGenerating(metadata);
  const generateError = readGenerativeCardError(metadata);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const editLocked = disabled || isGenerating;

  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const browseScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingScrollTopRef = useRef(0);

  const commitText = useCallback(
    (value: string) => {
      if (editLocked || !updateNodeData) return;
      updateNodeData(nodeId, (current) =>
        hasAiTextGeneratedHistory(current.inputs)
          ? withAiTextEditedResult(current, value)
          : withAiTextManualResult(current, value)
      );
    },
    [editLocked, nodeId, updateNodeData]
  );

  const textBuffer = useBufferedTextValue(text, commitText);
  const isTextEditing = editing && !generateError && !isGenerating;

  useEffect(() => {
    if ((generateError || isGenerating) && editing) {
      pendingScrollTopRef.current = textareaRef.current?.scrollTop ?? pendingScrollTopRef.current;
      setEditing(false);
    }
  }, [editing, generateError, isGenerating]);

  useEffect(() => {
    if (isGenerating && historyOpen) {
      setHistoryOpen(false);
    }
  }, [historyOpen, isGenerating]);

  useEffect(() => {
    if (!updateNodeData) return;
    updateNodeData(nodeId, (current) => ({
      metadata: withGenerativeCardEditing(current.metadata, editing),
    }));
  }, [editing, nodeId, updateNodeData]);

  useEffect(() => {
    return () => {
      if (!updateNodeData) return;
      updateNodeData(nodeId, (current) => ({
        metadata: withGenerativeCardEditing(current.metadata, false),
      }));
    };
  }, [nodeId, updateNodeData]);

  useLayoutEffect(() => {
    if (isTextEditing) {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const scrollTop = pendingScrollTopRef.current;
      textarea.focus({ preventScroll: true });
      textarea.scrollTop = scrollTop;
      const frame = window.requestAnimationFrame(() => {
        textarea.scrollTop = scrollTop;
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const browse = browseScrollRef.current;
    if (!browse) return;
    browse.scrollTop = pendingScrollTopRef.current;
  }, [isTextEditing]);

  const stopEditing = () => {
    pendingScrollTopRef.current = textareaRef.current?.scrollTop ?? 0;
    textBuffer.onBlur();
    setEditing(false);
  };

  const handleHistorySelect = (id: string) => {
    if (editLocked || !updateNodeData) return;
    const item = historyItems.items.find((entry) => entry.id === id);
    if (!item) return;
    pendingScrollTopRef.current = 0;
    setEditing(false);
    textBuffer.reset(item.text);
    updateNodeData(nodeId, (current) =>
      withAiTextHistorySelection(current, id)
    );
  };

  const handleDoubleClick = (event: MouseEvent) => {
    if (generateError) {
      event.stopPropagation();
      setErrorDetailOpen(true);
      return;
    }
    if (editLocked || editing) return;
    event.stopPropagation();
    pendingScrollTopRef.current = browseScrollRef.current?.scrollTop ?? 0;
    setEditing(true);
  };

  return (
    <>
      <div
        className={cn(
          "relative flex h-full w-full min-h-0 flex-col overflow-hidden",
          !isTextEditing && "cursor-text"
        )}
        onClick={handleDoubleClick}
      >
        <div className="h-full w-full min-h-0 p-4">
          <div
            ref={browseScrollRef}
            className={cn(
              "h-full min-h-0 rounded-lg",
              isTextEditing
                ? "overflow-hidden bg-muted/40 ring-1 ring-inset ring-border/70 dark:bg-neutral-900/50 dark:ring-neutral-600"
                : cn("overflow-auto", STUDIO_SCROLL)
            )}
          >
            {isTextEditing ? (
              <Textarea
                ref={textareaRef}
                value={textBuffer.value}
                onChange={(event) => textBuffer.onChange(event.target.value)}
                onFocus={textBuffer.onFocus}
                onBlur={stopEditing}
                onCompositionStart={textBuffer.onCompositionStart}
                onCompositionEnd={textBuffer.onCompositionEnd}
                readOnly={editLocked}
                maxLength={AI_TEXT_HARD_OUTPUT_MAX_CHARS}
                placeholder={t("workflow.aiTextPanel.cardInputPlaceholder")}
                className={cn(
                  "h-full min-h-0 w-full resize-none rounded-lg border-0 bg-transparent",
                  "p-3 text-base leading-relaxed text-foreground/90 shadow-none",
                  "focus-visible:border-0 focus-visible:ring-0",
                  STUDIO_SCROLL
                )}
              />
            ) : textBuffer.value ? (
              <p className="w-full whitespace-pre-wrap p-3 text-base leading-relaxed text-foreground/90">
                {textBuffer.value}
              </p>
            ) : (
              <p className="p-3 text-sm italic text-muted-foreground/50">
                {t("workflow.aiTextPanel.cardInputPlaceholder")}
              </p>
            )}
          </div>
        </div>

        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}

        {!generateError && showHistoryIcon && !isGenerating ? (
          <StudioToolbar>
            <StudioHistoryActionButton
              count={historyItems.items.length}
              onClick={() => setHistoryOpen(true)}
            />
          </StudioToolbar>
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
        <AiTextHistoryOverlay
          open={historyOpen}
          history={historyItems}
          currentOutput={textBuffer.value}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
        />
      ) : null}
    </>
  );
}

type StudioMediaKind = "image" | "video" | "audio";

function useStudioMediaUpload(params: {
  readonly nodeId: string;
  readonly kind: StudioMediaKind;
  readonly prompt: string;
  readonly hasMedia: boolean;
  readonly isGenerating: boolean;
  readonly disabled: boolean;
}) {
  const { t } = useTranslation();
  const toast = useAppToast();
  const { organization } = useAuth();
  const { updateNodeData } = useWorkflow();
  const { workflowId } = useParams<{ workflowId: string }>();
  const { configured: cloudConfigured, blocksGenerativeMedia } =
    useCloudStorageCanvasContext();
  const orgId = organization?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const i18nPrefix =
    params.kind === "image"
      ? ("workflow.aiImagePanel" as const)
      : params.kind === "video"
        ? ("workflow.aiVideoPanel" as const)
        : ("workflow.aiAudioPanel" as const);

  const mediaKind =
    params.kind === "image"
      ? ("ai-image" as const)
      : params.kind === "video"
        ? ("ai-video" as const)
        : ("ai-audio" as const);

  const accept =
    params.kind === "image"
      ? GENERATIVE_IMAGE_UPLOAD_ACCEPT
      : params.kind === "video"
        ? "video/*"
        : "audio/*";

  const handleClearPrompt = useCallback(() => {
    if (!updateNodeData) return;
    updateNodeData(params.nodeId, (current) => ({
      inputs: withGenerativePromptCleared(current.inputs),
    }));
  }, [params.nodeId, updateNodeData]);

  const { handleCardDoubleClick, uploadConfirmDialog } =
    useGenerativeCardDoubleClickUpload({
      prompt: params.prompt,
      hasMedia: params.hasMedia,
      isGenerating: params.isGenerating,
      disabled: params.disabled,
      blocksGenerativeMedia,
      uploading,
      fileInputRef,
      onClearPrompt: handleClearPrompt,
      i18nPrefix,
    });

  const setCardEditing = useCallback(
    (editing: boolean) => {
      if (!updateNodeData) return;
      updateNodeData(params.nodeId, (current) => ({
        metadata: withGenerativeCardEditing(current.metadata, editing),
      }));
    },
    [params.nodeId, updateNodeData]
  );

  useEffect(() => {
    return () => {
      setCardEditing(false);
    };
  }, [setCardEditing]);

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (
        params.disabled ||
        blocksGenerativeMedia ||
        !files?.length ||
        !updateNodeData ||
        !orgId
      ) {
        return;
      }

      const normalized = normalizeGenerativeCardUploadFile(
        files[0]!,
        params.kind
      );
      if (!normalized) {
        toast.error(
          params.kind === "image"
            ? "workflow.fields.invalidImageFile"
            : params.kind === "video"
              ? "workflow.fields.invalidVideoFile"
              : "workflow.fields.invalidAudioFile"
        );
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
          mediaKind,
          nodeType: mediaKind,
        });

        const uploadError = resolveGenerativeCardUploadError({
          value,
          cloudConfigured,
          t,
        });

        updateNodeData(params.nodeId, (current) => {
          const withMedia =
            params.kind === "image"
              ? withAiImageManualUpload(current, [value])
              : params.kind === "video"
                ? withAiVideoManualUpload(current, [value])
                : withAiAudioManualUpload(current, [value]);
          const withErrorMeta =
            params.kind === "image"
              ? withAiImageGenerateError(withMedia.metadata, uploadError)
              : params.kind === "video"
                ? withAiVideoGenerateError(withMedia.metadata, uploadError)
                : withAiAudioGenerateError(withMedia.metadata, uploadError);
          return {
            ...withMedia,
            metadata: withErrorMeta,
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
        updateNodeData(params.nodeId, (current) => ({
          metadata:
            params.kind === "image"
              ? withAiImageGenerateError(current.metadata, formatted)
              : params.kind === "video"
                ? withAiVideoGenerateError(current.metadata, formatted)
                : withAiAudioGenerateError(current.metadata, formatted),
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
      mediaKind,
      orgId,
      params.disabled,
      params.kind,
      params.nodeId,
      setCardEditing,
      t,
      toast,
      updateNodeData,
      workflowId,
    ]
  );

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={accept}
      className="hidden"
      onChange={(event) => {
        void handleUploadFiles(event.target.files);
        event.target.value = "";
      }}
    />
  );

  return {
    uploading,
    handleCardDoubleClick,
    uploadConfirmDialog,
    fileInput,
  };
}

function StudioPrimaryDownload({
  media,
  nodeType,
  filePrefix,
}: {
  readonly media: MediaReference | undefined;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly filePrefix: string;
}) {
  const expired = media ? isMediaExpired(media) : false;
  const { displayUrl, stale } = useMediaDisplayUrl({
    media: media && !expired ? media : null,
    nodeType,
    size: "full",
  });

  if (!media || !displayUrl || stale || expired) {
    return null;
  }

  const ext =
    nodeType === "ai-audio"
      ? "mp3"
      : (media.mimeType.split("/")[1] ??
        (nodeType === "ai-video" ? "mp4" : "png"));

  return (
    <StudioDownloadActionButton
      src={displayUrl}
      fileName={`${filePrefix}-${getMediaReferenceKey(media)}.${ext}`}
    />
  );
}

function StudioImageDetail({
  node,
}: {
  readonly node: ReactFlowNode<WorkflowNodeType>;
}) {
  const { updateNodeData, disabled = false } = useWorkflow();
  const nodeId = node.id;
  const metadata = node.data.metadata;
  const images = readAiImageCardImages(
    node.data.inputs,
    node.data.outputs,
    metadata
  );
  const historyItems = readAiImageResultHistory(node.data.inputs);
  const prompt = readGenerativePrompt(node.data.inputs);
  const isGenerating = isAiImageGenerating(metadata);
  const generateError = readGenerativeCardError(metadata);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);

  const { uploading, handleCardDoubleClick, uploadConfirmDialog, fileInput } =
    useStudioMediaUpload({
      nodeId,
      kind: "image",
      prompt,
      hasMedia: images.length > 0,
      isGenerating,
      disabled,
    });

  const handleHistorySelect = useCallback(
    (id: string) => {
      if (disabled || !updateNodeData) return;
      updateNodeData(nodeId, (current) =>
        withAiImageHistorySelection(current, id)
      );
    },
    [disabled, nodeId, updateNodeData]
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

  return (
    <>
      {uploadConfirmDialog}
      {fileInput}
      <div
        className={cn(
          "relative h-full w-full min-h-0 overflow-hidden",
          uploading && "opacity-70"
        )}
        onDoubleClick={(event) => {
          if (generateError) {
            event.stopPropagation();
            setErrorDetailOpen(true);
            return;
          }
          if (!isGenerating) {
            handleCardDoubleClick(event);
          }
        }}
      >
        <CreativeStudioNodePreview
          nodeId={nodeId}
          data={node.data}
          variant="detail"
          className="h-full"
        />
        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}
        {!generateError ? (
          <StudioToolbar>
            <StudioPrimaryDownload
              media={images[0]}
              nodeType="ai-image"
              filePrefix="image"
            />
            {showHistoryIcon ? (
              <StudioHistoryActionButton
                count={historyItems.items.length}
                onClick={() => setHistoryOpen(true)}
              />
            ) : null}
          </StudioToolbar>
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
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
          onExpandToNode={handleHistoryExpand}
        />
      ) : null}
    </>
  );
}

function StudioVideoDetail({
  node,
}: {
  readonly node: ReactFlowNode<WorkflowNodeType>;
}) {
  const { updateNodeData, disabled = false } = useWorkflow();
  const nodeId = node.id;
  const metadata = node.data.metadata;
  const videos = readAiVideoCardVideos(
    node.data.inputs,
    node.data.outputs,
    metadata
  );
  const historyItems = readAiVideoResultHistory(node.data.inputs);
  const prompt = readGenerativePrompt(node.data.inputs);
  const isGenerating = isAiVideoGenerating(metadata);
  const generateError = readGenerativeCardError(metadata);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);

  const { uploading, handleCardDoubleClick, uploadConfirmDialog, fileInput } =
    useStudioMediaUpload({
      nodeId,
      kind: "video",
      prompt,
      hasMedia: videos.length > 0,
      isGenerating,
      disabled,
    });

  const handleHistorySelect = useCallback(
    (id: string) => {
      if (disabled || !updateNodeData) return;
      updateNodeData(nodeId, (current) =>
        withAiVideoHistorySelection(current, id)
      );
    },
    [disabled, nodeId, updateNodeData]
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
      {fileInput}
      <div
        className={cn(
          "relative h-full w-full min-h-0 overflow-hidden",
          uploading && "opacity-70"
        )}
        onDoubleClick={(event) => {
          if (generateError) {
            event.stopPropagation();
            setErrorDetailOpen(true);
            return;
          }
          if (!isGenerating) {
            handleCardDoubleClick(event);
          }
        }}
      >
        <CreativeStudioNodePreview
          nodeId={nodeId}
          data={node.data}
          variant="detail"
          className="h-full"
        />
        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}
        {!generateError ? (
          <StudioToolbar>
            <StudioPrimaryDownload
              media={videos[0]}
              nodeType="ai-video"
              filePrefix="video"
            />
            {showHistoryIcon ? (
              <StudioHistoryActionButton
                count={historyItems.items.length}
                onClick={() => setHistoryOpen(true)}
              />
            ) : null}
          </StudioToolbar>
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
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
          onExpandToNode={handleHistoryExpand}
        />
      ) : null}
    </>
  );
}

function StudioAudioDetail({
  node,
}: {
  readonly node: ReactFlowNode<WorkflowNodeType>;
}) {
  const { updateNodeData, disabled = false } = useWorkflow();
  const nodeId = node.id;
  const metadata = node.data.metadata;
  const audios = readAiAudioCardAudios(
    node.data.inputs,
    node.data.outputs,
    metadata
  );
  const historyItems = readAiAudioResultHistory(node.data.inputs);
  const prompt = readGenerativePrompt(node.data.inputs);
  const isGenerating = isAiAudioGenerating(metadata);
  const generateError = readGenerativeCardError(metadata);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);

  const { uploading, handleCardDoubleClick, uploadConfirmDialog, fileInput } =
    useStudioMediaUpload({
      nodeId,
      kind: "audio",
      prompt,
      hasMedia: audios.length > 0,
      isGenerating,
      disabled,
    });

  const handleHistorySelect = useCallback(
    (id: string) => {
      if (disabled || !updateNodeData) return;
      updateNodeData(nodeId, (current) =>
        withAiAudioHistorySelection(current, id)
      );
    },
    [disabled, nodeId, updateNodeData]
  );

  const expandHistoryItem = useExpandHistoryToSiblingNode(nodeId, "audio");

  const handleHistoryExpand = useCallback(
    (id: string) => {
      const item = historyItems.items.find((entry) => entry.id === id);
      const media = item?.audios[0];
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

  const historyAsImageHistory = {
    items: historyItems.items.map((item) => ({
      id: item.id,
      images: item.audios,
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
      {fileInput}
      <div
        className={cn(
          "relative h-full w-full min-h-0 overflow-hidden",
          uploading && "opacity-70"
        )}
        onDoubleClick={(event) => {
          if (generateError) {
            event.stopPropagation();
            setErrorDetailOpen(true);
            return;
          }
          if (!isGenerating) {
            handleCardDoubleClick(event);
          }
        }}
      >
        <CreativeStudioNodePreview
          nodeId={nodeId}
          data={node.data}
          variant="detail"
          className="h-full"
        />
        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}
        {!generateError ? (
          <StudioToolbar>
            <StudioPrimaryDownload
              media={audios[0]}
              nodeType="ai-audio"
              filePrefix="audio"
            />
            {showHistoryIcon ? (
              <StudioHistoryActionButton
                count={historyItems.items.length}
                onClick={() => setHistoryOpen(true)}
              />
            ) : null}
          </StudioToolbar>
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
          currentImages={audios}
          mediaKind="audio"
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
          onExpandToNode={handleHistoryExpand}
        />
      ) : null}
    </>
  );
}
