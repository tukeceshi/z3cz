import { AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import { useCallback, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";

import {
  AiTextExpandButton,
  AiTextExpandOverlay,
} from "../../ai-text-expand-overlay";
import {
  AiTextHistoryButton,
  AiTextHistoryOverlay,
} from "../../ai-text-history-overlay";
import {
  AI_TEXT_CARD_HEIGHT_PX,
  AI_TEXT_HARD_OUTPUT_MAX_CHARS,
  readAiTextResult,
  readAiTextResultHistory,
  withAiTextHistorySelection,
} from "../../ai-text-node-utils";
import { useBufferedTextValue } from "../../use-buffered-text-value";
import { useWorkflow } from "../../workflow-context";
import type { BaseWidgetProps } from "../widget";
import { createWidget } from "../widget";

interface AiTextWidgetProps extends BaseWidgetProps {
  text: string | undefined;
  outputMaxChars: number;
  historyItems: ReturnType<typeof readAiTextResultHistory>;
  nodeId: string;
}

function AiTextWidget({
  text,
  outputMaxChars,
  historyItems,
  onChange,
  disabled = false,
  className,
  nodeId,
}: AiTextWidgetProps) {
  const { t } = useTranslation();
  const { updateNodeData } = useWorkflow();
  const [editing, setEditing] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const displayValue = text ?? "";

  const commitText = useCallback(
    (value: string) => {
      if (disabled) return;
      onChange(value);
    },
    [disabled, onChange]
  );

  const textBuffer = useBufferedTextValue(displayValue, commitText);

  const stopEditing = () => {
    textBuffer.onBlur();
    setEditing(false);
  };

  const handleHistorySelect = (id: string) => {
    if (disabled || !updateNodeData) return;
    const item = historyItems.items.find((entry) => entry.id === id);
    if (!item) return;

    textBuffer.flush();
    updateNodeData(nodeId, (current) =>
      withAiTextHistorySelection(current, id)
    );
    textBuffer.commit(item.text);
  };

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden p-3",
          !editing && "cursor-grab select-none",
          className
        )}
        style={{ height: AI_TEXT_CARD_HEIGHT_PX }}
        onDoubleClick={(event) => {
          if (disabled || editing) return;
          event.stopPropagation();
          setEditing(true);
        }}
      >
        {/*
          Idle: plain div so React Flow can drag (it blocks drag on TEXTAREA).
          Edit: textarea with nodrag. Avoid class-only pointer-events-none —
          React Compiler was stripping that class from the served bundle.
        */}
        {editing ? (
          <Textarea
            autoFocus
            value={textBuffer.value}
            onChange={(event) => textBuffer.onChange(event.target.value)}
            onFocus={textBuffer.onFocus}
            onBlur={stopEditing}
            onCompositionStart={textBuffer.onCompositionStart}
            onCompositionEnd={textBuffer.onCompositionEnd}
            readOnly={disabled}
            maxLength={outputMaxChars}
            placeholder={t("workflow.aiTextPanel.outputPlaceholder")}
            className="nodrag h-full min-h-0 resize-none border-0 bg-transparent p-0 text-sm leading-4 shadow-none focus-visible:ring-0 cursor-text select-text"
          />
        ) : (
          <div className="h-full overflow-hidden whitespace-pre-wrap break-words text-sm leading-4 text-foreground/80">
            {textBuffer.value || (
              <span className="text-muted-foreground/50 italic">
                {t("workflow.aiTextPanel.outputPlaceholder")}
              </span>
            )}
          </div>
        )}
        <div className="nodrag nopan nowheel absolute right-[7px] top-[7px] z-50 flex items-center gap-1.5">
          <AiTextHistoryButton
            count={historyItems.items.length}
            onClick={() => setHistoryOpen(true)}
          />
          <AiTextExpandButton onClick={() => setExpandOpen(true)} />
        </div>
      </div>

      <AiTextExpandOverlay
        open={expandOpen}
        title={t("workflow.aiTextPanel.outputTitle")}
        value={textBuffer.value}
        onChange={textBuffer.commit}
        onClose={() => setExpandOpen(false)}
        readOnly={disabled}
        maxLength={outputMaxChars}
        placeholder={t("workflow.aiTextPanel.outputPlaceholder")}
      />

      <AiTextHistoryOverlay
        open={historyOpen}
        history={historyItems}
        currentOutput={textBuffer.value}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleHistorySelect}
      />
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
  extractConfig: (nodeId, inputs, outputs) => ({
    text: readAiTextResult(inputs, outputs),
    outputMaxChars: AI_TEXT_HARD_OUTPUT_MAX_CHARS,
    historyItems: readAiTextResultHistory(inputs),
    nodeId,
  }),
});
