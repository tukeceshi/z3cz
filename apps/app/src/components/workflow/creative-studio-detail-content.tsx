import {
  AI_AUDIO_NODE_TYPE,
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  getMediaReferenceKey,
  type MediaReference,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import LoaderIcon from "lucide-react/icons/loader-circle";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { useResolvedAiText } from "@/hooks/use-resolved-ai-text";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { useCreativeStudio } from "@/components/workflow/creative-studio-context";
import { stageGenerativeCardUpload } from "@/services/stage-generative-media";
import { isMediaExpired } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import {
  AiTextHistoryOverlay,
} from "./ai-text-history-overlay";
import {
  commitAiTextHistorySelection,
  commitAiTextValue,
} from "./commit-ai-text-value";
import {
  AI_TEXT_HARD_OUTPUT_MAX_CHARS,
  isAiTextGenerating,
  readAiTextResultHistory,
} from "./ai-text-node-utils";
import {
  AiImageHistoryOverlay,
} from "./ai-image-history-overlay";
import { useExpandHistoryToSiblingNode } from "./use-expand-history-to-sibling-node";
import {
  useGenerativeHistoryModels,
  useHistoryModelUnavailableToast,
} from "./use-generative-history-models";
import {
  readAiImageCardPrimaryImage,
  readAiImageResultHistory,
  withAiImageGenerateError,
  withAiImageHistorySelection,
  withAiImageManualUpload,
} from "./ai-image-node-utils";
import {
  readAiVideoCardPrimaryVideo,
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
import { commitGenerativeHistorySelection } from "./commit-generative-history-selection";
import {
  GenerativeCardErrorBlock,
  GenerativeCardErrorDetailDialog,
} from "./generative-card-error-block";
import { GenerativeCardNoticeBlock } from "./generative-card-notice-block";
import { readGenerativeCardError } from "./generative-card-error-utils";
import {
  shouldShowGenerativeHistoryIcon,
  isGenerativeManualContent,
  withGenerativeGeneratedContentMode,
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
  dismissGenerativeCancelledNotice,
  isGenerativeCancelledNoticeVisible,
  subscribeGenerativeCancelledNotice,
} from "./generative-generation-cancel";
import { withGenerativeUploadProgress } from "./generative-progress-utils";
import {
  StudioDownloadActionButton,
  StudioHistoryActionButton,
  StudioViewToolbarButton,
} from "./creative-studio-detail-actions";
import { CreativeStudioNodePreview } from "./creative-studio-node-preview";
import {
  StudioImagePhotoProvider,
  StudioImageZoomHiddenTrigger,
  StudioImageZoomToolbarButton,
  studioImagePreviewZoomClassName,
  useStudioImageZoomTrigger,
} from "./studio-image-lightbox";
import { STUDIO_TEXT_DETAIL_EDIT_OVERLAY } from "./creative-studio-surface";
import { useAiTextOutputScroll } from "./use-ai-text-output-scroll";
import { StudioTextOutputView } from "./studio-text-output-view";
import { readStudioMediaCardState } from "./studio-media-card-state";
import { useBufferedTextValue } from "./use-buffered-text-value";
import { GenerativeCardEmptyUploadSlot } from "./generative-card-empty-upload-slot";
import { useGenerativeCardUpload } from "./use-generative-card-upload";
import { useTextCardFileUpload } from "./use-text-card-file-upload";
import { useWorkflow } from "./workflow-context";
import { StudioVideoLightbox } from "./studio-video-lightbox";
import type { WorkflowNodeType } from "./workflow-types";

export interface CreativeStudioDetailContentProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly onEmptyTextEditingChange?: (editing: boolean) => void;
}

export function CreativeStudioDetailContent({
  node,
  onEmptyTextEditingChange,
}: CreativeStudioDetailContentProps) {
  const nodeType = node.data.nodeType ?? "";

  if (nodeType === AI_TEXT_NODE_TYPE) {
    return (
      <StudioTextDetail
        node={node}
        onEmptyTextEditingChange={onEmptyTextEditingChange}
      />
    );
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
  onEmptyTextEditingChange,
}: {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly onEmptyTextEditingChange?: (editing: boolean) => void;
}) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const { workflowId } = useCreativeStudio();
  const { cloudConfigured } = useCloudStorageCanvasContext();
  const { updateNodeData, disabled = false } = useWorkflow();
  const historyModels = useGenerativeHistoryModels();
  const notifyHistoryModelUnavailable = useHistoryModelUnavailableToast();
  const nodeId = node.id;
  const metadata = node.data.metadata;
  const orgId = organization?.id;
  const resolvedText = useResolvedAiText({
    organizationId: orgId,
    workflowId,
    inputs: node.data.inputs,
    outputs: node.data.outputs,
  });
  const text = resolvedText.text;
  const historyItems = readAiTextResultHistory(node.data.inputs);
  const isGenerating = isAiTextGenerating(metadata);
  const generateError = readGenerativeCardError(metadata);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const editLocked = disabled || isGenerating;
  const hasOutput = text.trim().length > 0;
  const prompt = readGenerativePrompt(node.data.inputs);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const editSurfaceRef = useRef<HTMLDivElement>(null);

  const commitText = useCallback(
    (value: string) => {
      if (editLocked || !updateNodeData || !orgId || !workflowId) return;

      void commitAiTextValue({
        organizationId: orgId,
        workflowId,
        cloudConfigured,
        nodeId,
        value,
        updateNodeData,
        current: node.data,
      });
    },
    [
      cloudConfigured,
      editLocked,
      nodeId,
      orgId,
      updateNodeData,
      workflowId,
    ]
  );

  const textBuffer = useBufferedTextValue(text, commitText);
  const isTextEditing = editing && !generateError && !isGenerating;

  const {
    uploading,
    canUpload,
    handleUploadClick,
    uploadConfirmDialog,
    fileInput,
  } = useTextCardFileUpload({
    nodeId,
    prompt,
    hasOutput,
    isGenerating,
    disabled,
    fileInputRef,
    updateNodeData,
    onApplyText: (value) => {
      textBuffer.commit(value);
    },
  });

  const showEditHint =
    !disabled &&
    !isTextEditing &&
    !isGenerating &&
    !generateError &&
    (hasOutput || !uploading);
  const scrollText = isTextEditing ? textBuffer.value : text;
  const showEmptyUpload =
    !hasOutput && !isTextEditing && !isGenerating && !generateError && !uploading;
  const showEmptyBusy =
    !hasOutput && !isTextEditing && !generateError && (uploading || isGenerating);

  const {
    scrollContainerRef,
    textareaRef,
    handleScroll,
    rememberScrollForEdit,
    scrollToTailIfAllowed,
  } = useAiTextOutputScroll({
    text: scrollText,
    isGenerating,
    contentKey: `${nodeId}:${historyItems.selectedId ?? ""}`,
    variant: "studio-detail",
    isEditing: isTextEditing,
  });

  useEffect(() => {
    if ((generateError || isGenerating) && editing) {
      setEditing(false);
    }
  }, [editing, generateError, isGenerating]);

  const stopEditing = useCallback(() => {
    rememberScrollForEdit();
    textBuffer.onBlur();
    setEditing(false);
  }, [rememberScrollForEdit, textBuffer]);

  const beginOutputEdit = useCallback(() => {
    rememberScrollForEdit();
    textBuffer.onFocus();
    setEditing(true);
  }, [rememberScrollForEdit, textBuffer]);

  useEffect(() => {
    if (text.trim() || !isGenerativeManualContent(metadata) || !updateNodeData) {
      return;
    }
    updateNodeData(nodeId, (current) => ({
      metadata: withGenerativeGeneratedContentMode(current.metadata),
    }));
  }, [metadata, nodeId, text, updateNodeData]);

  useEffect(() => {
    onEmptyTextEditingChange?.(isTextEditing && !textBuffer.value.trim());
  }, [isTextEditing, onEmptyTextEditingChange, textBuffer.value]);

  useEffect(() => {
    return () => onEmptyTextEditingChange?.(false);
  }, [onEmptyTextEditingChange]);

  useEffect(() => {
    if (isGenerating && historyOpen) {
      setHistoryOpen(false);
    }
  }, [historyOpen, isGenerating]);

  useEffect(() => {
    if (!isTextEditing) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      stopEditing();
    };

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (editSurfaceRef.current?.contains(target)) {
        return;
      }
      stopEditing();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isTextEditing, stopEditing]);

  const handleHistorySelect = (id: string) => {
    if (editLocked || !updateNodeData || !orgId || !workflowId) return;
    const item = historyItems.items.find((entry) => entry.id === id);
    if (!item) return;
    setEditing(false);

    void (async () => {
      const committed = await commitAiTextHistorySelection({
        organizationId: orgId,
        workflowId,
        cloudConfigured,
        nodeId,
        selectedId: id,
        updateNodeData,
        current: node.data,
        models: historyModels.text,
      });
      textBuffer.reset(committed.resolvedText);
      notifyHistoryModelUnavailable(committed.modelUnavailable);
    })();
  };

  const handleDoubleClick = (event: MouseEvent) => {
    if (generateError) {
      event.stopPropagation();
      setErrorDetailOpen(true);
      return;
    }
    if (editLocked) return;
    event.stopPropagation();
    if (editing) return;
    beginOutputEdit();
  };

  return (
    <>
      {uploadConfirmDialog}
      {fileInput}
      <div
        className={cn(
          "relative flex h-full w-full min-h-0 flex-col overflow-hidden",
          !isTextEditing && "cursor-text"
        )}
        onDoubleClick={handleDoubleClick}
      >
        <div className="h-full w-full min-h-0 p-4">
          <div ref={editSurfaceRef} className="relative h-full min-h-0 rounded-lg">
            {showEditHint ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-3">
                <span className="rounded-md border border-border/30 bg-background/40 px-3 py-1 text-sm text-muted-foreground/50 backdrop-blur-sm dark:bg-neutral-900/40">
                  {t("workflow.aiTextPanel.cardDoubleClickInput")}
                </span>
              </div>
            ) : null}

            {isTextEditing ? (
              <div
                className={STUDIO_TEXT_DETAIL_EDIT_OVERLAY}
                aria-hidden="true"
              />
            ) : null}

            {showEmptyUpload ? (
              <GenerativeCardEmptyUploadSlot
                kind="text"
                size="studio-detail"
                canUpload={canUpload}
                onUploadClick={handleUploadClick}
                className="h-full"
              />
            ) : showEmptyBusy ? (
              <GenerativeCardEmptyUploadSlot
                kind="text"
                size="studio-detail"
                canUpload={false}
                onUploadClick={handleUploadClick}
                busy
                busyMessage={
                  uploading
                    ? t("workflow.aiTextPanel.cardUploading")
                    : t("workflow.aiTextPanel.generating")
                }
                className="h-full"
              />
            ) : (
              <StudioTextOutputView
                key={nodeId}
                value={textBuffer.value}
                onChange={textBuffer.onChange}
                onFocus={textBuffer.onFocus}
                onBlur={stopEditing}
                onCompositionStart={textBuffer.onCompositionStart}
                onCompositionEnd={textBuffer.onCompositionEnd}
                isEditing={editing}
                isGenerating={isGenerating}
                editLocked={editLocked}
                maxLength={AI_TEXT_HARD_OUTPUT_MAX_CHARS}
                placeholder={
                  showEditHint
                    ? undefined
                    : t("workflow.aiTextPanel.cardInputPlaceholder")
                }
                scrollContainerRef={scrollContainerRef}
                textareaRef={textareaRef}
                handleScroll={handleScroll}
                scrollToTailIfAllowed={scrollToTailIfAllowed}
                contentKey={`${nodeId}:${historyItems.selectedId ?? ""}`}
              />
            )}
          </div>
        </div>

        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}

        {!generateError && (isGenerating || showHistoryIcon) ? (
          <StudioToolbar>
            {isGenerating ? (
              <LoaderIcon className="size-3.5 animate-spin text-yellow-500" />
            ) : null}
            {showHistoryIcon && !isGenerating ? (
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
  const { workflowId } = useCreativeStudio();
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

  const { canUpload, handleUploadClick, uploadConfirmDialog } =
    useGenerativeCardUpload({
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
      updateNodeData(params.nodeId, (current) => ({
        metadata: withGenerativeUploadProgress(current.metadata, true),
      }));
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
            metadata: withGenerativeUploadProgress(withErrorMeta, false),
          };
        });

        if (uploadError) {
          toast.errorRaw(uploadError.summary);
        }
      } catch (error) {
        const formatted = prepareGenerativeCardError(
          error instanceof Error ? error.message : String(error),
          t,
          params.kind
        );
        updateNodeData(params.nodeId, (current) => ({
          metadata: withGenerativeUploadProgress(
            params.kind === "image"
              ? withAiImageGenerateError(current.metadata, formatted)
              : params.kind === "video"
                ? withAiVideoGenerateError(current.metadata, formatted)
                : withAiAudioGenerateError(current.metadata, formatted),
            false
          ),
        }));
        toast.errorRaw(formatted.summary);
      } finally {
        setUploading(false);
        if (updateNodeData) {
          updateNodeData(params.nodeId, (current) => ({
            metadata: withGenerativeUploadProgress(current.metadata, false),
          }));
        }
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
    canUpload,
    handleUploadClick,
    uploadConfirmDialog,
    fileInput,
  };
}

function StudioPrimaryDownload({
  media,
  nodeType,
  filePrefix,
  displayUrl,
  stale = false,
}: {
  readonly media: MediaReference | undefined;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly filePrefix: string;
  readonly displayUrl: string | null;
  readonly stale?: boolean;
}) {
  const expired = media ? isMediaExpired(media) : false;

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
  const historyModels = useGenerativeHistoryModels();
  const notifyHistoryModelUnavailable = useHistoryModelUnavailableToast();
  const nodeId = node.id;
  const metadata = node.data.metadata;
  const primaryImage = readAiImageCardPrimaryImage(
    node.data.inputs,
    node.data.outputs,
    metadata
  );
  const historyItems = readAiImageResultHistory(node.data.inputs);
  const prompt = readGenerativePrompt(node.data.inputs);
  const isGenerating = readStudioMediaCardState(metadata, false).isBusy;
  const generateError = readGenerativeCardError(metadata);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const imageExpired = primaryImage ? isMediaExpired(primaryImage) : false;
  const { displayUrl: imageDisplayUrl, stale: imageDisplayStale } =
    useMediaDisplayUrl({
      media: primaryImage && !imageExpired ? primaryImage : null,
      nodeType: "ai-image",
      size: "full",
    });

  const { uploading, canUpload, handleUploadClick, uploadConfirmDialog, fileInput } =
    useStudioMediaUpload({
      nodeId,
      kind: "image",
      prompt,
      hasMedia: primaryImage != null,
      isGenerating,
      disabled,
    });

  const canZoomImage =
    primaryImage != null &&
    imageDisplayUrl != null &&
    !imageDisplayStale &&
    !imageExpired &&
    !generateError &&
    !isGenerating &&
    !uploading;

  const {
    triggerRef: imageZoomTriggerRef,
    handlePreviewClick,
    handlePreviewDoubleClick: cancelPreviewZoom,
  } = useStudioImageZoomTrigger();

  const handleHistorySelect = useCallback(
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
      <StudioImagePhotoProvider>
        {canZoomImage && imageDisplayUrl ? (
          <StudioImageZoomHiddenTrigger
            src={imageDisplayUrl}
            triggerRef={imageZoomTriggerRef}
          />
        ) : null}
        <div
          className={cn(
            "relative h-full w-full min-h-0 overflow-hidden",
            studioImagePreviewZoomClassName(canZoomImage)
          )}
          onClick={(event) => handlePreviewClick(event, canZoomImage)}
          onDoubleClick={(event) => {
            cancelPreviewZoom(event);
            if (generateError) {
              setErrorDetailOpen(true);
            }
          }}
        >
          <CreativeStudioNodePreview
            nodeId={nodeId}
            data={node.data}
            variant="detail"
            className="h-full"
            uploading={uploading}
            generateError={generateError}
            detailDisplayUrl={imageDisplayUrl}
            detailDisplayStale={imageDisplayStale}
            emptyUpload={
              primaryImage == null && !generateError
                ? { kind: "image", canUpload, onUploadClick: handleUploadClick }
                : undefined
            }
          />
          {!generateError ? (
            <StudioToolbar>
              <StudioPrimaryDownload
                media={primaryImage}
                nodeType="ai-image"
                filePrefix="image"
                displayUrl={imageDisplayUrl}
                stale={imageDisplayStale}
              />
              {canZoomImage ? (
                <StudioImageZoomToolbarButton
                  onOpen={() => imageZoomTriggerRef.current?.click()}
                />
              ) : null}
              {showHistoryIcon ? (
                <StudioHistoryActionButton
                  count={historyItems.items.length}
                  onClick={() => setHistoryOpen(true)}
                />
              ) : null}
            </StudioToolbar>
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
  const { t } = useTranslation();
  const { updateNodeData, disabled = false } = useWorkflow();
  const historyModels = useGenerativeHistoryModels();
  const notifyHistoryModelUnavailable = useHistoryModelUnavailableToast();
  const nodeId = node.id;
  const metadata = node.data.metadata;
  const primaryVideo = readAiVideoCardPrimaryVideo(
    node.data.inputs,
    node.data.outputs,
    metadata
  );
  const historyItems = readAiVideoResultHistory(node.data.inputs);
  const prompt = readGenerativePrompt(node.data.inputs);
  const isGenerating = readStudioMediaCardState(metadata, true).isBusy;
  const generateError = readGenerativeCardError(metadata);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const [videoLightboxOpen, setVideoLightboxOpen] = useState(false);
  const videoExpired = primaryVideo ? isMediaExpired(primaryVideo) : false;
  const { displayUrl: videoDisplayUrl, stale: videoDisplayStale } =
    useMediaDisplayUrl({
      media: primaryVideo && !videoExpired ? primaryVideo : null,
      nodeType: "ai-video",
      size: "full",
    });
  const showCancelledNotice = useSyncExternalStore(
    subscribeGenerativeCancelledNotice,
    () => isGenerativeCancelledNoticeVisible(nodeId),
    () => false
  );
  const handleDismissCancelledNotice = useCallback(() => {
    dismissGenerativeCancelledNotice(nodeId);
  }, [nodeId]);

  const { uploading, canUpload, handleUploadClick, uploadConfirmDialog, fileInput } =
    useStudioMediaUpload({
      nodeId,
      kind: "video",
      prompt,
      hasMedia: primaryVideo != null,
      isGenerating,
      disabled,
    });

  const canViewVideo =
    primaryVideo != null &&
    videoDisplayUrl != null &&
    !videoDisplayStale &&
    !videoExpired &&
    !generateError &&
    !isGenerating &&
    !uploading;

  const handleHistorySelect = useCallback(
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
        className="relative h-full w-full min-h-0 overflow-hidden"
        onDoubleClick={(event) => {
          if (generateError) {
            event.stopPropagation();
            setErrorDetailOpen(true);
          }
        }}
      >
        <CreativeStudioNodePreview
          nodeId={nodeId}
          data={node.data}
          variant="detail"
          className="h-full"
          uploading={uploading}
          generateError={generateError}
          onVideoExpandView={() => setVideoLightboxOpen(true)}
          detailDisplayUrl={videoDisplayUrl}
          detailDisplayStale={videoDisplayStale}
          emptyUpload={
            primaryVideo == null && !generateError && !showCancelledNotice
              ? { kind: "video", canUpload, onUploadClick: handleUploadClick }
              : undefined
          }
        />
        {showCancelledNotice && !generateError ? (
          <GenerativeCardNoticeBlock
            message={t("workflow.generativeCancel.success")}
            dismissLabel={t("workflow.generativeCancel.dismiss")}
            onDismiss={handleDismissCancelledNotice}
          />
        ) : null}
        {!generateError && !showCancelledNotice ? (
          <StudioToolbar>
            <StudioPrimaryDownload
              media={primaryVideo}
              nodeType="ai-video"
              filePrefix="video"
              displayUrl={videoDisplayUrl}
              stale={videoDisplayStale}
            />
            {canViewVideo ? (
              <StudioViewToolbarButton
                onClick={() => setVideoLightboxOpen(true)}
              />
            ) : null}
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
          currentImages={primaryVideo ? [primaryVideo] : []}
          mediaKind="video"
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
          onExpandToNode={handleHistoryExpand}
        />
      ) : null}
      {canViewVideo && videoDisplayUrl ? (
        <StudioVideoLightbox
          open={videoLightboxOpen}
          src={videoDisplayUrl}
          onClose={() => setVideoLightboxOpen(false)}
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
  const historyModels = useGenerativeHistoryModels();
  const notifyHistoryModelUnavailable = useHistoryModelUnavailableToast();
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
  const primaryAudio = audios[0];
  const audioExpired = primaryAudio ? isMediaExpired(primaryAudio) : false;
  const { displayUrl: audioDisplayUrl, stale: audioDisplayStale } =
    useMediaDisplayUrl({
      media: primaryAudio && !audioExpired ? primaryAudio : null,
      nodeType: "ai-audio",
      size: "full",
    });

  const { uploading, canUpload, handleUploadClick, uploadConfirmDialog, fileInput } =
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
          }
        }}
      >
        <CreativeStudioNodePreview
          nodeId={nodeId}
          data={node.data}
          variant="detail"
          className="h-full"
          uploading={uploading}
          generateError={generateError}
          detailDisplayUrl={audioDisplayUrl}
          detailDisplayStale={audioDisplayStale}
          emptyUpload={
            audios.length === 0 && !generateError
              ? { kind: "audio", canUpload, onUploadClick: handleUploadClick }
              : undefined
          }
        />
        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}
        {!generateError ? (
          <StudioToolbar>
            <StudioPrimaryDownload
              media={primaryAudio}
              nodeType="ai-audio"
              filePrefix="audio"
              displayUrl={audioDisplayUrl}
              stale={audioDisplayStale}
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
