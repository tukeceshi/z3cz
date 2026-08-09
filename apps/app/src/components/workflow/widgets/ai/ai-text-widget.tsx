import { AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import LoaderIcon from "lucide-react/icons/loader-circle";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type MouseEvent,
} from "react";

import { useTranslation } from "@/components/locale-provider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";

import {
  AiTextExpandButton,
} from "../../ai-text-expand-overlay";
import { useOpenCreativeStudio } from "../../creative-studio-context";
import {
  AiTextHistoryButton,
  AiTextHistoryOverlay,
} from "../../ai-text-history-overlay";
import { STUDIO_SCROLL } from "../../creative-studio-surface";
import {
  AI_TEXT_HARD_OUTPUT_MAX_CHARS,
  isAiTextGenerating,
  readAiTextResult,
  readAiTextResultHistory,
  withAiTextHistorySelection,
} from "../../ai-text-node-utils";
import {
  GenerativeCardErrorBlock,
  GenerativeCardErrorDetailDialog,
} from "../../generative-card-error-block";
import { readGenerativeCardError } from "../../generative-card-error-utils";
import {
  shouldShowGenerativeHistoryIcon,
  isGenerativeManualContent,
  withGenerativeGeneratedContentMode,
} from "../../generative-card-mode-utils";
import { useAiTextOutputScroll } from "../../use-ai-text-output-scroll";
import { useBufferedTextValue } from "../../use-buffered-text-value";
import { useWorkflow } from "../../workflow-context";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiTextWidgetProps extends BaseWidgetProps {
  text: string | undefined;
  outputMaxChars: number;
  historyItems: ReturnType<typeof readAiTextResultHistory>;
  nodeId: string;
  metadata?: Record<string, string>;
  selected?: boolean;
  onEmptyOutputEditingChange?: (editing: boolean) => void;
}

function AiTextWidget({
  text,
  outputMaxChars,
  historyItems,
  onChange,
  disabled = false,
  className,
  nodeId,
  metadata,
  selected = false,
  onEmptyOutputEditingChange,
}: AiTextWidgetProps) {
  const { t } = useTranslation();
  const { updateNodeData } = useWorkflow();
  const openCreativeStudio = useOpenCreativeStudio(nodeId);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const [holdTailAfterGenerate, setHoldTailAfterGenerate] = useState(false);
  const displayValue = text ?? "";
  const isGenerating = isAiTextGenerating(metadata);
  const showHistoryIcon = shouldShowGenerativeHistoryIcon(
    historyItems.items.length,
    metadata
  );
  const generateError = readGenerativeCardError(metadata);
  const cardPlaceholder = t("workflow.aiTextPanel.cardInputPlaceholder");
  const editLocked = disabled || isGenerating;

  const commitText = useCallback(
    (value: string) => {
      if (editLocked) return;
      onChange(value);
    },
    [editLocked, onChange]
  );

  const textBuffer = useBufferedTextValue(displayValue, commitText);
  const isTextEditing = editing && !generateError && !isGenerating;

  const {
    scrollContainerRef,
    handleScroll,
    tailPreview,
  } = useAiTextOutputScroll({
    text: isTextEditing ? textBuffer.value : displayValue,
    isGenerating,
    contentKey: `${nodeId}:${historyItems.selectedId ?? ""}`,
    variant: "canvas-card",
    isEditing: isTextEditing,
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
    if ((generateError || isGenerating) && editing) {
      setEditing(false);
    }
  }, [generateError, isGenerating, editing]);

  useEffect(() => {
    if (isGenerating && historyOpen) {
      setHistoryOpen(false);
    }
  }, [isGenerating, historyOpen]);

  const stopEditing = () => {
    textBuffer.onBlur();
    setEditing(false);
  };

  const beginOutputEdit = useCallback(() => {
    textBuffer.onFocus();
    setEditing(true);
  }, [textBuffer]);

  useEffect(() => {
    if (displayValue.trim() || !isGenerativeManualContent(metadata) || !updateNodeData) {
      return;
    }
    updateNodeData(nodeId, (current) => ({
      metadata: withGenerativeGeneratedContentMode(current.metadata),
    }));
  }, [displayValue, metadata, nodeId, updateNodeData]);

  useEffect(() => {
    onEmptyOutputEditingChange?.(isTextEditing && !textBuffer.value.trim());
  }, [isTextEditing, onEmptyOutputEditingChange, textBuffer.value]);

  useEffect(() => {
    return () => onEmptyOutputEditingChange?.(false);
  }, [onEmptyOutputEditingChange]);

  const handleHistorySelect = (id: string) => {
    if (editLocked || !updateNodeData) return;
    const item = historyItems.items.find((entry) => entry.id === id);
    if (!item) return;

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
    if (editLocked) return;
    event.stopPropagation();
    if (textBuffer.value.trim()) {
      openCreativeStudio();
      return;
    }
    if (editing) return;
    beginOutputEdit();
  };

  return (
    <>
      <div
        className={cn(
          "relative flex h-full min-h-0 flex-col overflow-hidden p-3",
          !editing && "cursor-grab select-none",
          className
        )}
        onDoubleClick={handleDoubleClick}
      >
        {isTextEditing ? (
          <Textarea
            autoFocus
            value={textBuffer.value}
            onChange={(event) => textBuffer.onChange(event.target.value)}
            onFocus={textBuffer.onFocus}
            onBlur={stopEditing}
            onCompositionStart={textBuffer.onCompositionStart}
            onCompositionEnd={textBuffer.onCompositionEnd}
            readOnly={editLocked}
            maxLength={outputMaxChars}
            placeholder={cardPlaceholder}
            className="nodrag min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm leading-4 shadow-none focus-visible:ring-0 cursor-text select-text"
          />
        ) : (
          <div
            ref={scrollContainerRef}
            onScroll={tailPreview ? handleScroll : undefined}
            className={cn(
              "min-h-0 flex-1 whitespace-pre-wrap break-words text-sm leading-4 text-foreground/80",
              tailPreview
                ? cn("nodrag nopan nowheel overflow-y-auto", STUDIO_SCROLL)
                : "overflow-hidden"
            )}
          >
            {textBuffer.value || (
              <span className="text-muted-foreground/50 italic">
                {cardPlaceholder}
              </span>
            )}
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
          currentOutput={textBuffer.value}
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
    text: readAiTextResult(inputs, outputs),
    outputMaxChars: AI_TEXT_HARD_OUTPUT_MAX_CHARS,
    historyItems: readAiTextResultHistory(inputs),
    nodeId,
    metadata,
  }),
});
