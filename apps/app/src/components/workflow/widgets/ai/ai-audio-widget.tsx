import {
  AI_AUDIO_NODE_TYPE,
  getMediaReferenceKey,
  isLocalMediaReference,
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
import { getCachedMediaBlob } from "@/services/ai-media-cache-service";
import { readGenerativeStagingBlob } from "@/services/generative-media-staging";
import { isMediaExpired, resolveMediaFetchUrl } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import {
  AiImageHistoryButton,
  AiImageHistoryOverlay,
} from "../../ai-image-history-overlay";
import { AiTextExpandButton } from "../../ai-text-expand-overlay";
import { useOpenCreativeStudio } from "../../creative-studio-context";
import { readGenerativeProgressPhase } from "../../generative-progress-utils";
import {
  AI_AUDIO_CARD_HEIGHT_PX,
  AI_AUDIO_CARD_WIDTH_PX,
  isAiAudioGenerating,
  readAiAudioCardAudios,
  readAiAudioResultHistory,
  withAiAudioHistorySelection,
  withAiAudioGenerateError,
  withAiAudioManualUpload,
} from "../../ai-audio-node-utils";
import { useExpandHistoryToSiblingNode } from "../../use-expand-history-to-sibling-node";
import {
  GenerativeCardErrorBlock,
  GenerativeCardErrorDetailDialog,
} from "../../generative-card-error-block";
import { readGenerativeCardError } from "../../generative-card-error-utils";
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
import { GenerativeMediaDownloadButton } from "../../generative-media-download-button";
import { useGenerativeCardDoubleClickUpload } from "../../use-generative-card-double-click-upload";
import { useWorkflow } from "../../workflow-context";
import { WorkflowMediaAudioPlayer } from "../../workflow-media-audio-player";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface MediaAudioPreviewProps {
  readonly value: MediaReference;
  readonly className?: string;
  readonly nodeId: string;
}

function MediaAudioPreview({
  value,
  className,
  displayUrl,
  waveformBlob,
}: MediaAudioPreviewProps & {
  readonly displayUrl: string;
  readonly waveformBlob?: Blob;
}) {
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    setMediaError(false);
  }, [displayUrl]);

  if (mediaError) {
    return (
      <MediaAudioUnavailable className={className} />
    );
  }

  return (
    <WorkflowMediaAudioPlayer
      src={displayUrl}
      className={className}
      variant="card"
      waveformBlob={waveformBlob}
      waveformCacheKey={getMediaReferenceKey(value) ?? undefined}
      onError={() => setMediaError(true)}
    />
  );
}

function MediaAudioUnavailable({ className }: { readonly className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center px-3 text-center text-xs text-muted-foreground/50",
        className
      )}
    >
      {t("workflow.aiMediaCache.audioUnavailable")}
    </div>
  );
}

interface AiAudioWidgetProps extends BaseWidgetProps {
  audios: MediaReference[];
  historyItems: ReturnType<typeof readAiAudioResultHistory>;
  nodeId: string;
  prompt: string;
  metadata?: Record<string, string>;
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

function AiAudioWidget({
  audios,
  historyItems,
  disabled = false,
  className,
  nodeId,
  prompt,
  metadata,
}: AiAudioWidgetProps) {
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
    isAiAudioGenerating(metadata) || progressPhase !== undefined;
  useGenerativeMediaWorkSession(uploading || progressPhase !== undefined);
  const generateError = readGenerativeCardError(metadata);
  const cardPlaceholder = t(
    generativeCardProgressKey(
      progressPhase ??
        (isAiAudioGenerating(metadata) ? "generating" : null),
      "audio"
    )
  );
  const activeAudio = audios[0];
  const activeAudioExpired = activeAudio ? isMediaExpired(activeAudio) : false;
  const { displayUrl: activeAudioUrl, stale: activeAudioStale } =
    useMediaDisplayUrl({
      media: activeAudio && !activeAudioExpired ? activeAudio : null,
      nodeType: "ai-audio",
    });
  const [waveformBlob, setWaveformBlob] = useState<Blob | undefined>();

  useEffect(() => {
    if (!activeAudio || !orgId || !workflowId) {
      setWaveformBlob(undefined);
      return;
    }

    let cancelled = false;

    const resolveWaveformBlob = async (): Promise<Blob | undefined> => {
      if (isLocalMediaReference(activeAudio)) {
        const entry = await readGenerativeStagingBlob({
          mediaId: activeAudio.mediaId,
          organizationId: orgId,
          workflowId,
        });
        return entry?.blob;
      }

      const mediaId = getMediaReferenceKey(activeAudio);
      if (!mediaId) {
        return undefined;
      }

      const cachedBlob = await getCachedMediaBlob({
        organizationId: orgId,
        workflowId,
        mediaId,
      });
      if (cachedBlob) {
        return cachedBlob;
      }

      const fetchUrl = resolveMediaFetchUrl(activeAudio, orgId);
      if (fetchUrl && !fetchUrl.startsWith("blob:")) {
        const response = await fetch(fetchUrl, { credentials: "include" });
        if (response.ok) {
          return response.blob();
        }
      }

      if (!activeAudioUrl || activeAudioUrl.startsWith("blob:")) {
        return undefined;
      }

      const response = await fetch(activeAudioUrl, { credentials: "include" });
      if (!response.ok) {
        return undefined;
      }
      return response.blob();
    };

    void resolveWaveformBlob()
      .then((blob) => {
        if (cancelled) {
          return;
        }
        setWaveformBlob(blob);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setWaveformBlob(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [activeAudio, activeAudioUrl, orgId, workflowId]);

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
      hasMedia: Boolean(activeAudio),
      isGenerating,
      disabled,
      blocksGenerativeMedia,
      uploading,
      fileInputRef,
      onClearPrompt: handleClearPrompt,
      i18nPrefix: "workflow.aiAudioPanel",
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
        withAiAudioHistorySelection(current, id)
      );
    },
    [disabled, historyItems.items, nodeId, updateNodeData]
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
        modelDisplayName: item.modelDisplayName,
        createdAt: item.createdAt,
      });
    },
    [expandHistoryItem, historyItems.items]
  );

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (disabled || blocksGenerativeMedia || !files?.length || !updateNodeData || !orgId) return;

      const normalized = normalizeGenerativeCardUploadFile(files[0]!, "audio");
      if (!normalized) {
        toast.error("workflow.fields.invalidAudioFile");
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
          mediaKind: "ai-audio",
          nodeType: "ai-audio",
        });

        const uploadError = resolveGenerativeCardUploadError({
          value,
          cloudConfigured,
          t,
        });

        updateNodeData(nodeId, (current) => {
          const withMedia = withAiAudioManualUpload(current, [value]);
          return {
            ...withMedia,
            metadata: withAiAudioGenerateError(
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
          metadata: withAiAudioGenerateError(current.metadata, formatted),
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
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
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
          width: AI_AUDIO_CARD_WIDTH_PX,
          height: AI_AUDIO_CARD_HEIGHT_PX,
        }}
        onDoubleClick={(event) => {
          if (generateError) {
            event.stopPropagation();
            setErrorDetailOpen(true);
            return;
          }
          if (activeAudio && !isGenerating) {
            event.stopPropagation();
            openCreativeStudio();
            return;
          }
          if (!isGenerating) {
            handleCardDoubleClick(event);
          }
        }}
      >
        {!activeAudio && !generateError ? (
          <div className="flex h-full items-center justify-center px-3">
            <p className="text-center text-[11px] italic text-muted-foreground/50">
              {cardPlaceholder}
            </p>
          </div>
        ) : activeAudio ? (
          activeAudioStale || !activeAudioUrl ? (
            <MediaAudioUnavailable className="h-full w-full" />
          ) : (
            <MediaAudioPreview
              value={activeAudio}
              displayUrl={activeAudioUrl}
              waveformBlob={waveformBlob}
              className="h-full w-full"
              nodeId={nodeId}
            />
          )
        ) : null}

        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}

        {!generateError && activeAudio && activeAudioUrl && !activeAudioStale ? (
          <div className="nodrag nopan nowheel absolute right-2 top-2 z-50 flex items-center gap-1.5">
            <GenerativeMediaDownloadButton
              src={activeAudioUrl}
              fileName={`audio-${getMediaReferenceKey(activeAudio)}.mp3`}
            />
            {showHistoryIcon ? (
              <AiImageHistoryButton
                count={historyItems.items.length}
                onClick={() => setHistoryOpen(true)}
              />
            ) : null}
            <AiTextExpandButton onClick={openCreativeStudio} />
          </div>
        ) : null}

        {!generateError && showHistoryIcon && (!activeAudio || !activeAudioUrl || activeAudioStale) ? (
          <div className="nodrag nopan nowheel absolute right-2 top-2 z-50 flex items-center gap-1.5">
            <AiImageHistoryButton
              count={historyItems.items.length}
              onClick={() => setHistoryOpen(true)}
            />
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
          currentImages={audios}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
          onExpandToNode={handleHistoryExpand}
        />
      ) : null}
    </>
  );
}

export const aiAudioWidget = createWidget({
  component: AiAudioWidget,
  nodeTypes: [AI_AUDIO_NODE_TYPE],
  inputField: "prompt",
  managedFields: [
    "model",
    "prompt",
    "params",
    "manual_audios",
    "audios_result",
    "audios_history",
    "ai_interface_id",
  ],
  extractConfig: (nodeId, inputs, outputs, metadata) => ({
    audios: readAiAudioCardAudios(inputs, outputs, metadata),
    historyItems: readAiAudioResultHistory(inputs),
    nodeId,
    prompt: readGenerativePrompt(inputs),
    metadata,
  }),
});
