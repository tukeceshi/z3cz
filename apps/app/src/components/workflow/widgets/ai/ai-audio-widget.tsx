import {
  AI_AUDIO_NODE_TYPE,
  getResourceIdFromValue,
  hasDisplayableWorkflowMedia,
  hasFailedResource,
  hasGeneratingResource,
  type MediaReference,
  type ObjectReference,
  readNodeLayoutFromMetadata,
} from "@dafthunk/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
import { useGenerativeRecordErrorDisplay } from "@/hooks/use-generative-record-error-display";
import { useGenerativeMediaWorkSession } from "@/hooks/use-generative-media-before-unload";
import { generativeCardProgressKey } from "@/hooks/use-generative-cloud-job";
import { useCloudStorageCanvasContext } from "@/components/workflow/cloud-storage-canvas-provider";
import { stageGenerativeCardUpload } from "@/services/stage-generative-media";
import { warmCardUploadPersist } from "@/services/generative-card-upload-persist";
import { isMediaExpired } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import {
  AiImageHistoryButton,
  AiImageHistoryOverlay,
} from "../../ai-image-history-overlay";
import { AiTextExpandButton } from "../../ai-text-expand-overlay";
import { useOpenCreativeStudio } from "../../creative-studio-context";
import type { GenerativeCardCoverRead } from "../../generative-history-utils";
import {
  readGenerativeProgressPhase,
  withGenerativeUploadProgress,
} from "../../generative-progress-utils";
import {
  AI_AUDIO_CARD_HEIGHT_PX,
  AI_AUDIO_CARD_WIDTH_PX,
  readAiAudioCardDisplay,
  readAiAudioResultHistory,
  withAiAudioHistorySelection,
  withAiAudioGenerateError,
  withAiAudioManualUpload,
} from "../../ai-audio-node-utils";
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
import { createPatchNodeLayoutMetadata } from "../../patch-node-layout-metadata";
import { GenerativeMediaLazyDownloadButton } from "../../generative-media-download-button";
import { GenerativeCardEmptyUploadSlot } from "../../generative-card-empty-upload-slot";
import { useGenerativeCardUpload } from "../../use-generative-card-upload";
import { CanvasAudioCover } from "../../canvas-media-cover";
import { useWorkflow } from "../../workflow-context";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiAudioWidgetProps extends BaseWidgetProps {
  cardDisplay: GenerativeCardCoverRead<MediaReference>;
  historyItems: ReturnType<typeof readAiAudioResultHistory>;
  nodeId: string;
  prompt: string;
  metadata?: Record<string, string>;
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

function AiAudioWidget({
  cardDisplay,
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
  const persistedLayout = useMemo(
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
  const openCreativeStudio = useOpenCreativeStudio(nodeId);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const progressPhase = readGenerativeProgressPhase(metadata);
  const selectedHistoryItem =
    historyItems.items.find((item) => item.id === historyItems.selectedId) ??
    historyItems.items[0];
  const selectedFailed =
    Boolean(selectedHistoryItem?.jobId) &&
    (selectedHistoryItem.audios.length === 0 ||
      hasFailedResource(selectedHistoryItem.audios));
  const isGenerating =
    (!selectedFailed && cardDisplay.isBusy) ||
    progressPhase === "cancelled";
  useGenerativeMediaWorkSession(uploading || (!selectedFailed && cardDisplay.isBusy));
  useGenerativeRecordErrorDisplay({
    orgId,
    nodeId,
    jobId: selectedFailed ? selectedHistoryItem?.jobId : undefined,
    modality: "audio",
    enabled: selectedFailed,
    clearError: Boolean(
      selectedHistoryItem &&
        hasDisplayableWorkflowMedia(selectedHistoryItem.audios) &&
        !hasFailedResource(selectedHistoryItem.audios) &&
        !hasGeneratingResource(selectedHistoryItem.audios)
    ),
    updateNodeData,
  });
  const generateError = readGenerativeCardError(metadata);
  const cardPlaceholder = t(
    generativeCardProgressKey(
      progressPhase ?? (cardDisplay.isBusy ? "generating" : null),
      "audio"
    )
  );
  const coverAudio = cardDisplay.coverMedia[0];
  const hasAudio = cardDisplay.hasCover;
  const activeAudioExpired = hasAudio && coverAudio ? isMediaExpired(coverAudio) : false;
  const canDownloadActiveAudio = hasAudio && !activeAudioExpired;

  const handleClearPrompt = useCallback(() => {
    if (!updateNodeData) return;
    updateNodeData(nodeId, (current) => ({
      inputs: withGenerativePromptCleared(current.inputs),
    }));
  }, [nodeId, updateNodeData]);

  const { canUpload, handleUploadClick, uploadConfirmDialog } =
    useGenerativeCardUpload({
      prompt,
      hasMedia: hasAudio,
      isGenerating,
      disabled,
      blocksGenerativeMedia,
      uploading,
      fileInputRef,
      onClearPrompt: handleClearPrompt,
      i18nPrefix: "workflow.aiAudioPanel",
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
      historyItems.items,
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

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (disabled || blocksGenerativeMedia || !files?.length || !updateNodeData || !orgId || !workflowId) return;

      const normalized = normalizeGenerativeCardUploadFile(files[0]!, "audio");
      if (!normalized) {
        toast.error("workflow.fields.invalidAudioFile");
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
          mediaKind: "ai-audio",
          nodeType: "ai-audio",
          patchNodeLayout,
        });

        warmCardUploadPersist({
          organizationId: orgId,
          workflowId,
          staged,
          nodeType: "ai-audio",
          cloudConfigured,
        });

        const uploadError = resolveGenerativeCardUploadError({
          value: staged,
          cloudConfigured,
          t,
        });

        updateNodeData(nodeId, (current) => {
          const withMedia = withAiAudioManualUpload(current, [staged]);
          return {
            ...withMedia,
            metadata: withGenerativeUploadProgress(
              withAiAudioGenerateError(withMedia.metadata, uploadError),
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
          "audio"
        );
        updateNodeData(nodeId, (current) => ({
          metadata: withGenerativeUploadProgress(
            withAiAudioGenerateError(current.metadata, formatted),
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
          width: persistedLayout?.width ?? AI_AUDIO_CARD_WIDTH_PX,
          height: persistedLayout?.height ?? AI_AUDIO_CARD_HEIGHT_PX,
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
        {!hasAudio && !generateError ? (
          <GenerativeCardEmptyUploadSlot
            kind="audio"
            size="canvas"
            doubleClickHintKey="workflow.studio.cardDoubleClickOpenStudio"
            busy={isGenerating || uploading}
            busyMessage={cardPlaceholder}
            canUpload={canUpload}
            onUploadClick={handleUploadClick}
          />
        ) : hasAudio && coverAudio ? (
          <CanvasAudioCover className="h-full w-full" />
        ) : null}

        {generateError ? <GenerativeCardErrorBlock error={generateError} /> : null}

        {!generateError && hasAudio ? (
          <div className="nodrag nopan nowheel absolute right-2 top-2 z-50 flex items-center gap-1.5">
            {canDownloadActiveAudio && coverAudio ? (
              <GenerativeMediaLazyDownloadButton
                media={coverAudio}
                nodeType="ai-audio"
                fileName={`audio-${getResourceIdFromValue(coverAudio) ?? "audio"}.mp3`}
              />
            ) : null}
            {showHistoryIcon ? (
              <AiImageHistoryButton
                count={historyItems.items.length}
                onClick={() => setHistoryOpen(true)}
              />
            ) : null}
            <AiTextExpandButton onClick={openCreativeStudio} />
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
          currentImages={
            selectedHistoryItem?.audios.length
              ? [...selectedHistoryItem.audios]
              : coverAudio
                ? [coverAudio]
                : []
          }
          mediaKind="audio"
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
    cardDisplay: readAiAudioCardDisplay(inputs, outputs, metadata),
    historyItems: readAiAudioResultHistory(inputs),
    nodeId,
    prompt: readGenerativePrompt(inputs),
    metadata,
  }),
});
