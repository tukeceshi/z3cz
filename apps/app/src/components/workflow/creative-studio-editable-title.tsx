import type { Node as ReactFlowNode } from "@xyflow/react";
import Pencil from "lucide-react/icons/pencil";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/utils";

import { resolveStudioNodeLabel } from "./creative-studio-utils";
import { STUDIO_PANEL_TITLE } from "./creative-studio-surface";
import { updateNodeName, useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

const TITLE_INPUT_MIN_WIDTH_PX = 72;
const TITLE_INPUT_MAX_WIDTH_PX = 320;
const TITLE_INPUT_HORIZONTAL_PAD_PX = 24;

export interface CreativeStudioEditableTitleProps {
  readonly node: ReactFlowNode<WorkflowNodeType>;
  readonly className?: string;
}

export function CreativeStudioEditableTitle({
  node,
  className,
}: CreativeStudioEditableTitleProps) {
  const { t } = useTranslation();
  const { updateNodeData, disabled = false } = useWorkflow();
  const label = resolveStudioNodeLabel(node, t);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [inputWidthPx, setInputWidthPx] = useState(TITLE_INPUT_MIN_WIDTH_PX);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(label);
    }
  }, [editing, label]);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [editing]);

  useLayoutEffect(() => {
    if (!editing) return;
    const measure = measureRef.current;
    if (!measure) return;
    const textWidth = Math.ceil(measure.getBoundingClientRect().width);
    const nextWidth = Math.min(
      TITLE_INPUT_MAX_WIDTH_PX,
      Math.max(
        TITLE_INPUT_MIN_WIDTH_PX,
        textWidth + TITLE_INPUT_HORIZONTAL_PAD_PX
      )
    );
    setInputWidthPx(nextWidth);
  }, [draft, editing]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === label || !updateNodeData || disabled) {
      setDraft(label);
      return;
    }
    updateNodeName(node.id, next, updateNodeData);
  };

  const cancel = () => {
    setDraft(label);
    setEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-1 items-center justify-start gap-1",
        className
      )}
    >
      {editing ? (
        <>
          <span
            ref={measureRef}
            aria-hidden
            className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre text-sm font-medium"
          >
            {draft || " "}
          </span>
          <Input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-label={t("workflow.studio.renameNode")}
            className="h-8 w-auto max-w-none shrink-0 border-border/60 bg-background px-2 text-sm font-medium shadow-none focus-visible:ring-1"
            style={{ width: inputWidthPx }}
          />
        </>
      ) : (
        <>
          <h3
            className={cn(STUDIO_PANEL_TITLE, "min-w-0 truncate")}
            title={label}
          >
            {label}
          </h3>
          {!disabled ? (
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={t("workflow.studio.renameNode")}
              title={t("workflow.studio.renameNode")}
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
