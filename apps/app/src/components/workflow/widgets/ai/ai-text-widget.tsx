import { AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import LoaderIcon from "lucide-react/icons/loader-circle";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useGenerativeRecordErrorDisplay } from "@/hooks/use-generative-record-error-display";
import { useResolvedAiText } from "@/hooks/use-resolved-ai-text";
import { cn } from "@/utils/utils";

import { AiTextExpandButton } from "../../ai-text-expand-overlay";
import { commitAiTextHistorySelection } from "../../commit-ai-text-value";
import { useOpenCreativeStudio } from "../../creative-studio-context";
import {
  AiTextHistoryButton,
  AiTextHistoryOverlay,
} from "../../ai-text-history-overlay";
import { STUDIO_SCROLL } from "../../creative-studio-surface";
import {
  AI_TEXT_HARD_OUTPUT_MAX_CHARS,
  isAiTextGenerating,
  isAiTextAwaitingStream,
  readAiTextResultHistory,
  readAiTextSessionBodySync,
} from "../../ai-text-node-utils";
import {
  GenerativeCardErrorBlock,
  GenerativeCardErrorDetailDialog,
} from "../../generative-card-error-block";
import { readGenerativeCardError } from "../../generative-card-error-utils";
import { GenerativeBusyOverlay } from "../../generative-busy-overlay";
import { GenerativeCardEmptyUploadSlot } from "../../generative-card-empty-upload-slot";
import {
  shouldShowGenerativeHistoryIcon,
  isGenerativeManualContent,
  withGenerativeGeneratedContentMode,
} from "../../generative-card-mode-utils";
import { readGenerativePrompt } from "../../generative-card-upload-utils";
import { useAiTextOutputScroll } from "../../use-ai-text-output-scroll";
import { useTextCardFileUpload } from "../../use-text-card-file-upload";
import { useWorkflow } from "../../workflow-context";
import type { WorkflowNodeType } from "../../workflow-types";
import {
  useGenerativeHistoryModels,
  useHistoryModelUnavailableToast,
} from "../../use-generative-history-models";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiTextWidgetProps extends BaseWidgetProps {
  outputMaxChars: number;
  historyItems: ReturnType<typeof readAiTextResultHistory>;
  nodeId: string;
  nodeData: WorkflowNodeType;
  prompt: string;
  metadata?: Record<string, string>;
  selected?: boolean;
  onEmptyOutputEditingChange?: (editing: boolean) => void;
}

function AiTextWidget({
  historyItems,
  onChange,
  disabled = false,
  className,
  nodeId,
  nodeData,
  prompt,
  metadata,
  selected = false,
  onEmptyOutputEditingChange,
}: AiTextWidgetProps) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const orgId = organization?.id;
  const { id: workflowId } = useParams<{ id: string }>();
  const { updateNodeData } = useWorkflow();
  const openCreativeStudio = useOpenCreativeStudio(nodeId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const [holdTailAfterGenerate, setHoldTailAfterGenerate] = useState(false);
  const isGenerating = isAiTextGenerating(metadata);
  const streamBody = readAiTextSessionBodySync(nodeData);
  const resolvedText = useResolvedAiText({
    inputs: nodeData.inputs,
    outputs: nodeData.outputs,
    nodeData,
  });
  const resolvedOutput = (resolvedText.text || resolvedText.displayExcerpt).trim();
  const hasStreamOutput = streamBody.trim().length > 0;
  const showFullBody = isGenerating || selected;
  const displayValue = showFullBody
    ? isGenerating
      ? hasStreamOutput
        ? streamBody
        : resolvedText.text || resolvedText.displayExcerpt
      : resolvedText.text
    : resolvedText.displayExcerpt;
  const hasOutput = isGenerating
    ? hasStreamOutput || resolvedOutput.length > 0
    : resolvedOutput.length > 0;
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const selectedHistoryItem =
    historyItems.items.find((item) => item.id === historyItems.selectedId) ??
    historyItems.items[0];
  const selectedFailed =
    Boolean(selectedHistoryItem) &&
    !selectedHistoryItem.contentSha256 &&
    !selectedHistoryItem.text &&
    Boolean(selectedHistoryItem.invocationId) &&
    !isGenerating;
  useGenerativeRecordErrorDisplay({
    orgId,
    nodeId,
    invocationId: selectedFailed ? selectedHistoryItem?.invocationId : undefined,
    modality: "text",
    enabled: selectedFailed && Boolean(selectedHistoryItem?.invocationId),
    clearError: Boolean(
      selectedHistoryItem?.resourceId || selectedHistoryItem?.text
    ),
    updateNodeData,
  });
  const generateError = readGenerativeCardError(metadata);
  const showTextLoading =
    resolvedText.loading &&
    !hasOutput &&
    !isGenerating &&
    !generateError &&
    !selectedFailed;
  const showGeneratingMask =
    isAiTextAwaitingStream(metadata) && !generateError;
  const generatingMessage = t("workflow.aiTextPanel.generating");
  const editLocked = disabled || isGenerating;

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
    onApplyText: onChange,
  });

  const {
    scrollContainerRef,
    handleScroll,
    tailPreview,
  } = useAiTextOutputScroll({
    text: displayValue,
    isGenerating,
    contentKey: `${nodeId}:${historyItems.selectedId ?? ""}`,
    variant: "canvas-card",
    isEditing: false,
    selected,
    holdTailAfterComplete: selected && holdTailAfterGenerate,
  });

  useEffect(() => {
    if (isGenerating) {
      setHoldTailAfterGenerate(true);
    }
    if (!selected) {
      setHoldTailAfterGenerate(false);
    }
  }, [isGenerating, selected]);

  useLayoutEffect(() => {
    setHoldTailAfterGenerate(false);
  }, [nodeId]);

  useEffect(() => {
    if (isGenerating && historyOpen) {
      setHistoryOpen(false);
    }
  }, [isGenerating, historyOpen]);

  useEffect(() => {
    if (hasOutput || !isGenerativeManualContent(metadata) || !updateNodeData) {
      return;
    }
    updateNodeData(nodeId, (current) => ({
      metadata: withGenerativeGeneratedContentMode(current.metadata),
    }));
  }, [hasOutput, metadata, nodeId, updateNodeData]);

  useEffect(() => {
    onEmptyOutputEditingChange?.(false);
  }, [onEmptyOutputEditingChange]);

  useEffect(() => {
    return () => onEmptyOutputEditingChange?.(false);
  }, [onEmptyOutputEditingChange]);

  const historyModels = useGenerativeHistoryModels();
  const notifyHistoryModelUnavailable = useHistoryModelUnavailableToast();

  const handleHistorySelect = useCallback(
    (id: string) => {
      if (editLocked || !updateNodeData || !orgId || !workflowId) return;

      void (async () => {
        const committed = await commitAiTextHistorySelection({
          organizationId: orgId,
          workflowId,
          nodeId,
          selectedId: id,
          updateNodeData,
          current: nodeData,
          models: historyModels.text,
        });
        notifyHistoryModelUnavailable(committed.modelUnavailable);
      })();
    },
    [
      editLocked,
      historyModels.text,
      nodeData,
      nodeId,
      notifyHistoryModelUnavailable,
      orgId,
      updateNodeData,
      workflowId,
    ]
  );

  const handleDoubleClick = (event: MouseEvent) => {
    if (generateError) {
      event.stopPropagation();
      setErrorDetailOpen(true);
      return;
    }
    if (editLocked) return;
    event.stopPropagation();
    openCreativeStudio();
  };

  const showEmptyUpload =
    !hasOutput &&
    !showTextLoading &&
    !generateError &&
    !isGenerating &&
    !uploading;
  const showEmptyBusy =
    !hasOutput &&
    !showTextLoading &&
    !generateError &&
    uploading;

  return (
    <>
      {uploadConfirmDialog}
      {fileInput}
      <div
        className={cn(
          "relative flex h-full min-h-0 flex-col overflow-hidden",
          "cursor-grab select-none",
          className
        )}
        onDoubleClick={handleDoubleClick}
      >
        {showEmptyUpload ? (
          <GenerativeCardEmptyUploadSlot
            kind="text"
            size="canvas"
            doubleClickHintKey="workflow.aiTextPanel.cardDoubleClickInput"
            canUpload={canUpload}
            onUploadClick={handleUploadClick}
            className="min-h-0 flex-1"
          />
        ) : showEmptyBusy ? (
          <GenerativeCardEmptyUploadSlot
            kind="text"
            size="canvas"
            canUpload={false}
            onUploadClick={handleUploadClick}
            busy
            busyMessage={uploading ? t("workflow.aiTextPanel.cardUploading") : generatingMessage}
            className="min-h-0 flex-1"
          />
        ) : showTextLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <LoaderIcon className="h-4 w-4 animate-spin text-muted-foreground/50" />
          </div>
        ) : (
          <div className="relative min-h-0 flex-1">
            <div
              ref={scrollContainerRef}
              onScroll={tailPreview ? handleScroll : undefined}
              className={cn(
                "h-full min-h-0 whitespace-pre-wrap break-words p-3 text-sm leading-4 text-foreground/80",
                tailPreview
                  ? cn("nodrag nopan nowheel overflow-y-auto", STUDIO_SCROLL)
                  : "overflow-hidden"
              )}
            >
              {displayValue}
            </div>
            <GenerativeBusyOverlay
              visible={showGeneratingMask}
              modality={null}
              metadata={metadata}
              label={generatingMessage}
            />
          </div>
        )}

        {generateError ? (
          <GenerativeCardErrorBlock error={generateError} />
        ) : null}

        {!generateError ? (
          <div className="nodrag nopan nowheel absolute right-[7px] top-[7px] z-50 flex items-center gap-1.5">
            {isGenerating ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin text-yellow-500" />
            ) : null}
            {showHistoryIcon && !isGenerating ? (
              <AiTextHistoryButton
                count={historyItems.items.length}
                onClick={() => setHistoryOpen(true)}
              />
            ) : null}
            {!isGenerating ? (
              <AiTextExpandButton onClick={openCreativeStudio} />
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
        <AiTextHistoryOverlay
          open={historyOpen}
          history={historyItems}
          currentId={historyItems.selectedId}
          organizationId={orgId}
          workflowId={workflowId}
          onClose={() => setHistoryOpen(false)}
          onSelect={handleHistorySelect}
        />
      ) : null}
    </>
  );
}

export const aiTextWidget = createWidget({
  component: AiTextWidget,
  nodeTypes: [AI_TEXT_NODE_TYPE],
  inputField: "result",
  managedFields: [
    "ai_interface_id",
    "model",
    "keywords",
    "prompt",
    "result",
    "result_history",
  ],
  extractConfig: (nodeId, inputs, outputs, metadata) => ({
    outputMaxChars: AI_TEXT_HARD_OUTPUT_MAX_CHARS,
    historyItems: readAiTextResultHistory(inputs),
    nodeId,
    nodeData: {
      id: nodeId,
      type: "workflowNode",
      name: "AI Text",
      nodeType: AI_TEXT_NODE_TYPE,
      position: { x: 0, y: 0 },
      inputs: [...inputs],
      outputs: [...outputs],
      metadata,
    },
    prompt: readGenerativePrompt(inputs),
    metadata,
  }),
});
