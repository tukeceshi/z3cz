import type { WorkflowMediaValue } from "@dafthunk/types";
import { isWorkflowMediaValue } from "@dafthunk/types";
import ImageOffIcon from "lucide-react/icons/image-off";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CompositionEvent,
  type FocusEvent,
} from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/components/locale-provider";
import { useReferenceThumbUrl } from "@/hooks/use-reference-thumb-url";
import { cn } from "@/utils/utils";

import {
  ReferenceHoverPreview,
  type AiTextReferenceChip,
} from "./ai-text-reference-bar";
import { VIDEO_PROMPT_REF_TOKEN_PATTERN } from "./video-prompt-compile";

const MENTION_PICKER_GAP_PX = 6;
const MENTION_PICKER_MAX_HEIGHT_PX = 200;

interface MentionPickerState {
  readonly query: string;
  readonly anchor: DOMRect;
  readonly mentionRange: Range;
}

interface HoverPreviewState {
  readonly chip: AiTextReferenceChip;
  readonly anchor: DOMRect;
}

export interface VideoPromptMentionEditorProps {
  readonly value: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly imageChips: readonly AiTextReferenceChip[];
  readonly onChange: (value: string) => void;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
  readonly onCompositionStart?: () => void;
  readonly onCompositionEnd?: (event: CompositionEvent<HTMLDivElement>) => void;
}

function mediaNodeTypeForChip(
  chip: AiTextReferenceChip
): "ai-image" | "ai-video" | undefined {
  if (chip.kind === "image") return "ai-image";
  if (chip.kind === "video") return "ai-video";
  return undefined;
}

function chipMedia(chip: AiTextReferenceChip): WorkflowMediaValue | null {
  return chip.media && isWorkflowMediaValue(chip.media) ? chip.media : null;
}

function listStoredRefEdgeIds(stored: string): readonly string[] {
  const ids: string[] = [];
  for (const match of stored.matchAll(VIDEO_PROMPT_REF_TOKEN_PATTERN)) {
    const edgeId = match[1];
    if (edgeId) ids.push(edgeId);
  }
  return ids;
}

function serializeEditorRoot(root: HTMLElement): string {
  let result = "";
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? "";
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    const edgeId = node.dataset.refEdgeId;
    if (edgeId) {
      result += `{{ref:${edgeId}}}`;
      continue;
    }
    if (node.tagName === "BR") {
      result += "\n";
      continue;
    }
    result += serializeEditorRoot(node);
  }
  return result;
}

function flattenNodeToMentionScanText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (!(node instanceof HTMLElement)) return "";
  if (node.dataset.refEdgeId) return "";
  let text = "";
  for (const child of node.childNodes) {
    text += flattenNodeToMentionScanText(child);
  }
  return text;
}

function getTextBeforeCursor(root: HTMLElement): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return "";
  const cursorRange = selection.getRangeAt(0);
  if (!root.contains(cursorRange.startContainer)) return "";

  const preRange = document.createRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(cursorRange.startContainer, cursorRange.startOffset);
  return flattenNodeToMentionScanText(preRange.cloneContents());
}

function createChipElement(
  edgeId: string,
  chip: AiTextReferenceChip | undefined
): HTMLSpanElement {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.refEdgeId = edgeId;
  span.className = cn(
    "mx-0.5 inline-flex max-w-full select-none items-center gap-0.5 align-middle",
    chip ? "cursor-default" : "cursor-not-allowed"
  );

  const at = document.createElement("span");
  at.className = "text-[10px] leading-none text-muted-foreground";
  at.textContent = "@";
  span.appendChild(at);

  const frame = document.createElement("span");
  frame.className = cn(
    "inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border",
    chip ? "border-border" : "border-dashed border-muted-foreground/40"
  );
  frame.dataset.chipFrame = "true";
  span.appendChild(frame);

  return span;
}

function renderStoredPromptToEditor(
  root: HTMLElement,
  stored: string,
  chipByEdgeId: ReadonlyMap<string, AiTextReferenceChip>
): void {
  root.replaceChildren();
  const pattern = new RegExp(VIDEO_PROMPT_REF_TOKEN_PATTERN.source, "g");
  let lastIndex = 0;

  for (const match of stored.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      root.appendChild(document.createTextNode(stored.slice(lastIndex, start)));
    }
    const edgeId = match[1] ?? "";
    root.appendChild(createChipElement(edgeId, chipByEdgeId.get(edgeId)));
    lastIndex = start + match[0].length;
  }

  if (lastIndex < stored.length) {
    root.appendChild(document.createTextNode(stored.slice(lastIndex)));
  }
}

function insertChipAtRange(
  range: Range,
  edgeId: string,
  chip?: AiTextReferenceChip
): void {
  range.deleteContents();
  const chipNode = createChipElement(edgeId, chip);
  range.insertNode(chipNode);
  range.setStartAfter(chipNode);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function MentionPickerThumb({ chip }: { readonly chip: AiTextReferenceChip }) {
  const media = chipMedia(chip);
  const thumbUrl = useReferenceThumbUrl({
    media,
    nodeType: mediaNodeTypeForChip(chip),
  });

  if (thumbUrl) {
    return (
      <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
    );
  }

  return (
    <span className="flex h-full w-full items-center justify-center text-muted-foreground">
      <ImageOffIcon className="h-3.5 w-3.5" />
    </span>
  );
}

function MentionPicker({
  anchor,
  query,
  chips,
  onPick,
}: {
  readonly anchor: DOMRect;
  readonly query: string;
  readonly chips: readonly AiTextReferenceChip[];
  readonly onPick: (chip: AiTextReferenceChip) => void;
}) {
  const { t } = useTranslation();
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return chips;
    return chips.filter((chip) =>
      chip.label.toLowerCase().includes(normalized)
    );
  }, [chips, query]);

  const style = {
    left: anchor.left,
    top: anchor.bottom + MENTION_PICKER_GAP_PX,
  } as const;

  return createPortal(
    <div
      className="nodrag nopan nowheel fixed z-[250] w-52 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
      style={{ ...style, maxHeight: MENTION_PICKER_MAX_HEIGHT_PX }}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      {filtered.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {chips.length === 0
            ? t("workflow.aiVideoPanel.promptMentionEmpty")
            : t("workflow.aiVideoPanel.promptMentionNoMatch")}
        </p>
      ) : (
        filtered.map((chip) => (
          <button
            key={chip.edgeId}
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent"
            onClick={() => onPick(chip)}
          >
            <span className="inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-border">
              <MentionPickerThumb chip={chip} />
            </span>
            <span className="min-w-0 truncate text-xs">{chip.label}</span>
          </button>
        ))
      )}
    </div>,
    document.body
  );
}

function EditorChipThumbHydrator({
  edgeId,
  chip,
  editorRef,
  onHover,
  onHoverEnd,
}: {
  readonly edgeId: string;
  readonly chip: AiTextReferenceChip | undefined;
  readonly editorRef: React.RefObject<HTMLDivElement | null>;
  readonly onHover: (chip: AiTextReferenceChip, anchor: DOMRect) => void;
  readonly onHoverEnd: () => void;
}) {
  const media = chip ? chipMedia(chip) : null;
  const thumbUrl = useReferenceThumbUrl({
    media,
    nodeType: chip ? mediaNodeTypeForChip(chip) : undefined,
  });

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const chipEl = root.querySelector<HTMLElement>(`[data-ref-edge-id="${edgeId}"]`);
    const frame = chipEl?.querySelector<HTMLElement>('[data-chip-frame="true"]');
    if (!frame) return;

    frame.replaceChildren();
    if (chip && thumbUrl) {
      const img = document.createElement("img");
      img.src = thumbUrl;
      img.alt = chip.label;
      img.className = "h-full w-full object-cover";
      frame.appendChild(img);
    } else {
      const icon = document.createElement("span");
      icon.className =
        "flex h-full w-full items-center justify-center text-muted-foreground";
      icon.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><path d="M18 12l-4.5-4.5"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/></svg>';
      frame.appendChild(icon);
    }

    if (!chipEl) return;
    const handleEnter = () => {
      if (!chip) return;
      onHover(chip, chipEl.getBoundingClientRect());
    };
    chipEl.addEventListener("mouseenter", handleEnter);
    chipEl.addEventListener("mouseleave", onHoverEnd);
    return () => {
      chipEl.removeEventListener("mouseenter", handleEnter);
      chipEl.removeEventListener("mouseleave", onHoverEnd);
    };
  }, [chip, edgeId, editorRef, onHover, onHoverEnd, thumbUrl]);

  return null;
}

export function VideoPromptMentionEditor({
  value,
  disabled = false,
  readOnly = false,
  placeholder,
  className,
  imageChips,
  onChange,
  onFocus,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
}: VideoPromptMentionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);
  const composingRef = useRef(false);
  const lastRenderedValueRef = useRef(value);
  const [mentionPicker, setMentionPicker] = useState<MentionPickerState | null>(
    null
  );
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(
    null
  );

  const chipByEdgeId = useMemo(() => {
    const map = new Map<string, AiTextReferenceChip>();
    for (const chip of imageChips) {
      map.set(chip.edgeId, chip);
    }
    return map;
  }, [imageChips]);

  const storedEdgeIds = useMemo(() => listStoredRefEdgeIds(value), [value]);

  const syncDomFromValue = useCallback(
    (stored: string) => {
      const root = editorRef.current;
      if (!root) return;
      renderStoredPromptToEditor(root, stored, chipByEdgeId);
      lastRenderedValueRef.current = stored;
    },
    [chipByEdgeId]
  );

  useEffect(() => {
    if (value !== lastRenderedValueRef.current) {
      syncDomFromValue(value);
      return;
    }
    if (!isFocusedRef.current) {
      syncDomFromValue(value);
    }
  }, [chipByEdgeId, syncDomFromValue, value]);

  const emitChange = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;
    const next = serializeEditorRoot(root);
    lastRenderedValueRef.current = next;
    onChange(next);
  }, [onChange]);

  const closeMentionPicker = useCallback(() => {
    setMentionPicker(null);
  }, []);

  const handleHoverChip = useCallback(
    (chip: AiTextReferenceChip, anchor: DOMRect) => {
      setHoverPreview({ chip, anchor });
    },
    []
  );

  const handleHoverEnd = useCallback(() => {
    setHoverPreview(null);
  }, []);

  const updateMentionPicker = useCallback(() => {
    const root = editorRef.current;
    if (!root || composingRef.current || readOnly || disabled) {
      closeMentionPicker();
      return;
    }
    if (imageChips.length === 0) {
      closeMentionPicker();
      return;
    }

    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed || selection.rangeCount === 0) {
      closeMentionPicker();
      return;
    }

    const before = getTextBeforeCursor(root);
    const match = before.match(/@([^\s@]*)$/);
    if (!match) {
      closeMentionPicker();
      return;
    }

    const query = match[1] ?? "";
    const cursorRange = selection.getRangeAt(0);
    if (cursorRange.startContainer.nodeType !== Node.TEXT_NODE) {
      closeMentionPicker();
      return;
    }

    const textNode = cursorRange.startContainer as Text;
    const mentionStart = cursorRange.startOffset - query.length - 1;
    if (mentionStart < 0 || textNode.data[mentionStart] !== "@") {
      closeMentionPicker();
      return;
    }

    const mentionRange = document.createRange();
    mentionRange.setStart(textNode, mentionStart);
    mentionRange.setEnd(textNode, cursorRange.startOffset);

    const anchor = cursorRange.getBoundingClientRect();
    setMentionPicker({ query, anchor, mentionRange });
  }, [closeMentionPicker, disabled, imageChips.length, readOnly]);

  const handleInput = useCallback(() => {
    emitChange();
    updateMentionPicker();
  }, [emitChange, updateMentionPicker]);

  const handlePickMention = useCallback(
    (chip: AiTextReferenceChip) => {
      const root = editorRef.current;
      if (!root || !mentionPicker) return;

      insertChipAtRange(mentionPicker.mentionRange, chip.edgeId, chip);
      closeMentionPicker();
      emitChange();
      root.focus();
    },
    [closeMentionPicker, emitChange, mentionPicker]
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      isFocusedRef.current = true;
      setIsFocused(true);
      onFocus?.();
      event.currentTarget.focus();
    },
    [onFocus]
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const related = event.relatedTarget;
      if (related instanceof Node && event.currentTarget.contains(related)) {
        return;
      }
      isFocusedRef.current = false;
      setIsFocused(false);
      closeMentionPicker();
      setHoverPreview(null);
      onBlur?.();
    },
    [closeMentionPicker, onBlur]
  );

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
    closeMentionPicker();
    onCompositionStart?.();
  }, [closeMentionPicker, onCompositionStart]);

  const handleCompositionEnd = useCallback(
    (event: CompositionEvent<HTMLDivElement>) => {
      composingRef.current = false;
      onCompositionEnd?.(event);
      emitChange();
      updateMentionPicker();
    },
    [emitChange, onCompositionEnd, updateMentionPicker]
  );

  const showPlaceholder = !readOnly && value.length === 0 && !isFocused;

  return (
    <>
      <div className="relative h-full min-h-0">
        {placeholder && showPlaceholder ? (
          <p className="pointer-events-none absolute inset-0 select-none text-sm leading-4 text-muted-foreground">
            {placeholder}
          </p>
        ) : null}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          contentEditable={!disabled && !readOnly}
          suppressContentEditableWarning
          className={cn(
            "h-full min-h-0 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-4 outline-none thin-scrollbar",
            (disabled || readOnly) && "cursor-default",
            className
          )}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              closeMentionPicker();
            }
          }}
        />
      </div>

      {storedEdgeIds.map((edgeId) => (
        <EditorChipThumbHydrator
          key={edgeId}
          edgeId={edgeId}
          chip={chipByEdgeId.get(edgeId)}
          editorRef={editorRef}
          onHover={handleHoverChip}
          onHoverEnd={handleHoverEnd}
        />
      ))}

      {mentionPicker ? (
        <MentionPicker
          anchor={mentionPicker.anchor}
          query={mentionPicker.query}
          chips={imageChips}
          onPick={handlePickMention}
        />
      ) : null}

      {hoverPreview ? (
        <ReferenceHoverPreview
          chip={hoverPreview.chip}
          anchor={hoverPreview.anchor}
        />
      ) : null}
    </>
  );
}
