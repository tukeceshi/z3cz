import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { updateNodeName } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

type UpdateNodeFn = (nodeId: string, data: Partial<WorkflowNodeType>) => void;

const RENAME_LINE_HEIGHT_PX = 28;
const RENAME_MAX_LINES = 3;
const RENAME_MIN_HEIGHT_PX = RENAME_LINE_HEIGHT_PX;
const RENAME_MAX_HEIGHT_PX = RENAME_LINE_HEIGHT_PX * RENAME_MAX_LINES;

function stripLineBreaks(value: string): string {
  return value.replace(/\r?\n/g, " ");
}

export function syncStudioRenameTextareaHeight(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "0px";
  const next = Math.min(
    RENAME_MAX_HEIGHT_PX,
    Math.max(RENAME_MIN_HEIGHT_PX, textarea.scrollHeight)
  );
  textarea.style.height = `${next}px`;
  textarea.style.overflowY =
    textarea.scrollHeight > RENAME_MAX_HEIGHT_PX ? "auto" : "hidden";
}

export interface UseStudioNodeRenameOptions {
  readonly nodeId: string;
  readonly label: string;
  readonly editing: boolean;
  readonly onFinishEditing: () => void;
  readonly updateNodeData?: UpdateNodeFn;
  readonly disabled?: boolean;
  /** Long names wrap visually; line breaks cannot be entered. */
  readonly wrap?: boolean;
}

export function useStudioNodeRename({
  nodeId,
  label,
  editing,
  onFinishEditing,
  updateNodeData,
  disabled = false,
  wrap = false,
}: UseStudioNodeRenameOptions) {
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(label);
    }
  }, [editing, label]);

  useEffect(() => {
    if (!editing) return;
    const field = wrap ? textareaRef.current : inputRef.current;
    if (!field) return;

    const focusAndSelect = () => {
      field.focus();
      field.select();
    };

    focusAndSelect();
    const frame = requestAnimationFrame(focusAndSelect);
    return () => cancelAnimationFrame(frame);
  }, [editing, wrap]);

  useLayoutEffect(() => {
    if (!editing || !wrap) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    syncStudioRenameTextareaHeight(textarea);
  }, [draft, editing, wrap]);

  const setDraftValue = useCallback(
    (value: string) => {
      setDraft(wrap ? stripLineBreaks(value) : value);
    },
    [wrap]
  );

  const commit = useCallback(() => {
    const next = draft.trim();
    onFinishEditing();
    if (!next || next === label || !updateNodeData || disabled) {
      setDraft(label);
      return;
    }
    updateNodeName(nodeId, next, updateNodeData);
  }, [draft, disabled, label, nodeId, onFinishEditing, updateNodeData]);

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };

  return {
    draft,
    setDraft: setDraftValue,
    inputRef,
    textareaRef,
    commit,
    handleKeyDown,
  };
}
