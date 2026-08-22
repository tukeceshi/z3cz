import ImageIcon from "lucide-react/icons/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CompositionEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import {
  ReferenceChipMediaThumb,
  ReferenceHoverPreview,
  type AiTextReferenceChip,
} from "./ai-text-reference-bar";
import { VIDEO_PROMPT_REF_TOKEN_PATTERN } from "./video-prompt-compile";
import {
  applyMentionPick,
  detectMention,
  domRangeToFlatIndex,
  resolveMentionPickerAnchor,
  setDomCaretToFlatIndex,
} from "./video-prompt-mention-utils";

const MENTION_PICKER_GAP_PX = 6;
const MENTION_PICKER_MAX_HEIGHT_PX = 200;
const VIDEO_PROMPT_EDITOR_TEXT_CLASS =
  "text-sm leading-6" as const;

interface MentionPickerState {
  readonly query: string;
  readonly anchor: DOMRect;
  readonly mentionStartStored: number;
  readonly mentionEndStored: number;
  readonly mentionStartFlat: number;
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
  readonly thumbUrls?: ReadonlyMap<string, string | null>;
  readonly onChange: (value: string) => void;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
  readonly onCompositionStart?: () => void;
  readonly onCompositionEnd?: (event: CompositionEvent<HTMLDivElement>) => void;
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

function appendChipFrameContent(
  frame: HTMLSpanElement,
  chip: AiTextReferenceChip | undefined,
  thumbUrl: string | null | undefined
): void {
  frame.replaceChildren();
  if (chip && thumbUrl) {
    const img = document.createElement("img");
    img.src = thumbUrl;
    img.alt = chip.label;
    img.className = "h-full w-full object-cover";
    frame.appendChild(img);
    return;
  }

  const icon = document.createElement("span");
  icon.className =
    "flex h-full w-full items-center justify-center text-muted-foreground";
  icon.innerHTML = chip
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><path d="M18 12l-4.5-4.5"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/></svg>';
  frame.appendChild(icon);
}

function createChipElement(
  edgeId: string,
  chip: AiTextReferenceChip | undefined,
  thumbUrl: string | null | undefined
): HTMLSpanElement {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.refEdgeId = edgeId;
  span.className = cn(
    "mx-0.5 inline-flex max-w-full select-none items-center gap-0.5 align-middle",
    chip ? "cursor-default" : "cursor-not-allowed"
  );

  const at = document.createElement("span");
  at.className = "inline-flex shrink-0 items-center self-center text-[10px] leading-none text-muted-foreground";
  at.textContent = "@";
  span.appendChild(at);

  const frame = document.createElement("span");
  frame.className = cn(
    "inline-flex h-5 w-5 shrink-0 items-center justify-center self-center overflow-hidden rounded-md border",
    chip ? "border-border" : "border-dashed border-muted-foreground/40"
  );
  frame.dataset.chipFrame = "true";
  appendChipFrameContent(frame, chip, thumbUrl);
  span.appendChild(frame);

  return span;
}

function renderStoredPromptToEditor(
  root: HTMLElement,
  stored: string,
  chipByEdgeId: ReadonlyMap<string, AiTextReferenceChip>,
  thumbUrls: ReadonlyMap<string, string | null> | undefined
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
    root.appendChild(
      createChipElement(
        edgeId,
        chipByEdgeId.get(edgeId),
        thumbUrls?.get(edgeId)
      )
    );
    lastIndex = start + match[0].length;
  }

  if (lastIndex < stored.length) {
    root.appendChild(document.createTextNode(stored.slice(lastIndex)));
  }
}

function updateChipThumbsInEditor(
  root: HTMLElement,
  chipByEdgeId: ReadonlyMap<string, AiTextReferenceChip>,
  thumbUrls: ReadonlyMap<string, string | null> | undefined
): void {
  for (const chipEl of root.querySelectorAll<HTMLElement>("[data-ref-edge-id]")) {
    const edgeId = chipEl.dataset.refEdgeId;
    if (!edgeId) continue;
    const frame = chipEl.querySelector<HTMLElement>('[data-chip-frame="true"]');
    if (!(frame instanceof HTMLSpanElement)) continue;
    appendChipFrameContent(
      frame,
      chipByEdgeId.get(edgeId),
      thumbUrls?.get(edgeId)
    );
  }
}

function chipMatchesQuery(chip: AiTextReferenceChip, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return chip.label.toLowerCase().includes(normalized);
}

function filterChipsByQuery(
  chips: readonly AiTextReferenceChip[],
  query: string
): readonly AiTextReferenceChip[] {
  return chips.filter((chip) => chipMatchesQuery(chip, query));
}

function MentionPicker({
  visible,
  anchor,
  query,
  chips,
  activeIndex,
  thumbUrls,
  onPick,
  onActiveIndexChange,
}: {
  readonly visible: boolean;
  readonly anchor: DOMRect | null;
  readonly query: string;
  readonly chips: readonly AiTextReferenceChip[];
  readonly activeIndex: number;
  readonly thumbUrls?: ReadonlyMap<string, string | null>;
  readonly onPick: (chip: AiTextReferenceChip) => void;
  readonly onActiveIndexChange: (index: number) => void;
}) {
  const { t } = useTranslation();
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const filteredChips = useMemo(
    () => filterChipsByQuery(chips, query),
    [chips, query]
  );

  useEffect(() => {
    if (!visible || filteredChips.length === 0) return;
    const chip = filteredChips[activeIndex];
    if (!chip) return;
    itemRefs.current.get(chip.edgeId)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filteredChips, visible]);

  const style = {
    left: anchor?.left ?? 0,
    top: (anchor?.bottom ?? 0) + MENTION_PICKER_GAP_PX,
  } as const;

  return createPortal(
    <div
      hidden={!visible}
      aria-hidden={!visible}
      role="listbox"
      className="nodrag nopan nowheel fixed z-[250] w-52 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
      style={{ ...style, maxHeight: MENTION_PICKER_MAX_HEIGHT_PX }}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      {visible && filteredChips.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {chips.length === 0
            ? t("workflow.aiVideoPanel.promptMentionEmpty")
            : t("workflow.aiVideoPanel.promptMentionNoMatch")}
        </p>
      ) : null}
      {filteredChips.map((chip, index) => (
        <button
          key={chip.edgeId}
          ref={(element) => {
            if (element) {
              itemRefs.current.set(chip.edgeId, element);
              return;
            }
            itemRefs.current.delete(chip.edgeId);
          }}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={cn(
            "flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent",
            index === activeIndex && "bg-accent"
          )}
          onMouseEnter={() => onActiveIndexChange(index)}
          onClick={() => onPick(chip)}
        >
          <span className="relative inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-border">
            <ReferenceChipMediaThumb
              chip={chip}
              fallbackIcon={<ImageIcon className="h-3.5 w-3.5" />}
              thumbUrl={thumbUrls?.get(chip.edgeId)}
            />
          </span>
          <span className="min-w-0 truncate text-xs">{chip.label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}

export function VideoPromptMentionEditor({
  value,
  disabled = false,
  readOnly = false,
  placeholder,
  className,
  imageChips,
  thumbUrls,
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
  const flatCaretIndexRef = useRef(0);
  const [mentionPicker, setMentionPicker] = useState<MentionPickerState | null>(
    null
  );
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(
    null
  );

  const filteredMentionChips = useMemo(
    () =>
      mentionPicker
        ? filterChipsByQuery(imageChips, mentionPicker.query)
        : [],
    [imageChips, mentionPicker]
  );

  useEffect(() => {
    setMentionActiveIndex(0);
  }, [
    mentionPicker?.mentionEndStored,
    mentionPicker?.mentionStartStored,
    mentionPicker?.query,
  ]);

  useEffect(() => {
    if (mentionActiveIndex < filteredMentionChips.length) {
      return;
    }
    setMentionActiveIndex(
      Math.max(0, filteredMentionChips.length - 1)
    );
  }, [filteredMentionChips.length, mentionActiveIndex]);

  const chipByEdgeId = useMemo(() => {
    const map = new Map<string, AiTextReferenceChip>();
    for (const chip of imageChips) {
      map.set(chip.edgeId, chip);
    }
    return map;
  }, [imageChips]);

  const syncDomFromValue = useCallback(
    (stored: string) => {
      const root = editorRef.current;
      if (!root) return;
      renderStoredPromptToEditor(root, stored, chipByEdgeId, thumbUrls);
      lastRenderedValueRef.current = stored;
    },
    [chipByEdgeId, thumbUrls]
  );

  useEffect(() => {
    if (value !== lastRenderedValueRef.current) {
      syncDomFromValue(value);
      return;
    }
    if (!isFocusedRef.current) {
      syncDomFromValue(value);
    }
  }, [chipByEdgeId, syncDomFromValue, thumbUrls, value]);

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    updateChipThumbsInEditor(root, chipByEdgeId, thumbUrls);
  }, [chipByEdgeId, thumbUrls, value]);

  const readStoredFromEditor = useCallback((): string => {
    const root = editorRef.current;
    if (!root) return value;
    return serializeEditorRoot(root);
  }, [value]);

  const syncFlatCaretFromSelection = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;

    const selection = window.getSelection();
    if (
      !selection ||
      !selection.isCollapsed ||
      selection.rangeCount === 0 ||
      !root.contains(selection.anchorNode)
    ) {
      return;
    }

    flatCaretIndexRef.current = domRangeToFlatIndex(
      root,
      selection.getRangeAt(0)
    );
  }, []);

  const emitChange = useCallback(() => {
    const next = readStoredFromEditor();
    lastRenderedValueRef.current = next;
    onChange(next);
  }, [onChange, readStoredFromEditor]);

  const closeMentionPicker = useCallback(() => {
    setMentionPicker(null);
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

    syncFlatCaretFromSelection();
    const stored = readStoredFromEditor();
    const mention = detectMention(stored, flatCaretIndexRef.current);
    if (!mention) {
      closeMentionPicker();
      return;
    }

    const anchor = resolveMentionPickerAnchor(root, mention.mentionEndFlat);

    setMentionPicker({
      query: mention.query,
      anchor,
      mentionStartStored: mention.mentionStartStored,
      mentionEndStored: mention.mentionEndStored,
      mentionStartFlat: mention.mentionStartFlat,
    });
  }, [
    closeMentionPicker,
    disabled,
    imageChips.length,
    readOnly,
    readStoredFromEditor,
    syncFlatCaretFromSelection,
  ]);

  const scheduleMentionPickerUpdate = useCallback(() => {
    requestAnimationFrame(() => {
      updateMentionPicker();
    });
  }, [updateMentionPicker]);

  const handleInput = useCallback(() => {
    emitChange();
    scheduleMentionPickerUpdate();
  }, [emitChange, scheduleMentionPickerUpdate]);

  const handlePickMention = useCallback(
    (chip: AiTextReferenceChip) => {
      const root = editorRef.current;
      if (!root || !mentionPicker) return;

      const stored = readStoredFromEditor();
      const next = applyMentionPick(
        stored,
        mentionPicker.mentionStartStored,
        mentionPicker.mentionEndStored,
        chip.edgeId
      );
      const caretFlatIndex = mentionPicker.mentionStartFlat + 1;

      lastRenderedValueRef.current = next;
      onChange(next);
      renderStoredPromptToEditor(root, next, chipByEdgeId, thumbUrls);
      closeMentionPicker();

      requestAnimationFrame(() => {
        setDomCaretToFlatIndex(root, caretFlatIndex);
        flatCaretIndexRef.current = caretFlatIndex;
        root.focus();
      });
    },
    [
      chipByEdgeId,
      closeMentionPicker,
      mentionPicker,
      onChange,
      readStoredFromEditor,
      thumbUrls,
    ]
  );

  const handleMentionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!mentionPicker) {
        if (event.key === "Escape") {
          closeMentionPicker();
        }
        return;
      }

      if (filteredMentionChips.length === 0) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeMentionPicker();
        }
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionActiveIndex(
          (current) => (current + 1) % filteredMentionChips.length
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionActiveIndex(
          (current) =>
            (current - 1 + filteredMentionChips.length) %
            filteredMentionChips.length
        );
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const chip = filteredMentionChips[mentionActiveIndex];
        if (chip) {
          handlePickMention(chip);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeMentionPicker();
      }
    },
    [
      closeMentionPicker,
      filteredMentionChips,
      handlePickMention,
      mentionActiveIndex,
      mentionPicker,
    ]
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      isFocusedRef.current = true;
      setIsFocused(true);
      onFocus?.();
      syncFlatCaretFromSelection();
      event.currentTarget.focus();
    },
    [onFocus, syncFlatCaretFromSelection]
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
      scheduleMentionPickerUpdate();
    },
    [emitChange, onCompositionEnd, scheduleMentionPickerUpdate]
  );

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    const handleSelectionChange = () => {
      if (!isFocusedRef.current || composingRef.current) return;
      syncFlatCaretFromSelection();
      scheduleMentionPickerUpdate();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [scheduleMentionPickerUpdate, syncFlatCaretFromSelection]);

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const chipEl = target.closest<HTMLElement>("[data-ref-edge-id]");
      if (!chipEl || !root.contains(chipEl)) return;
      const edgeId = chipEl.dataset.refEdgeId;
      if (!edgeId) return;
      const chip = chipByEdgeId.get(edgeId);
      if (!chip) return;
      setHoverPreview({ chip, anchor: chipEl.getBoundingClientRect() });
    };

    const handleMouseOut = (event: MouseEvent) => {
      const related = event.relatedTarget;
      if (related instanceof Node) {
        const relatedChip =
          related instanceof HTMLElement
            ? related.closest("[data-ref-edge-id]")
            : null;
        if (relatedChip && root.contains(relatedChip)) {
          return;
        }
      }
      setHoverPreview(null);
    };

    root.addEventListener("mouseover", handleMouseOver);
    root.addEventListener("mouseout", handleMouseOut);
    return () => {
      root.removeEventListener("mouseover", handleMouseOver);
      root.removeEventListener("mouseout", handleMouseOut);
    };
  }, [chipByEdgeId]);

  const showPlaceholder = !readOnly && value.length === 0 && !isFocused;

  return (
    <>
      <div className="relative h-full min-h-0">
        {placeholder && showPlaceholder ? (
          <p
            className={cn(
              "pointer-events-none absolute inset-0 select-none text-muted-foreground",
              VIDEO_PROMPT_EDITOR_TEXT_CLASS
            )}
          >
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
            "h-full min-h-0 overflow-y-auto whitespace-pre-wrap break-words outline-none thin-scrollbar",
            VIDEO_PROMPT_EDITOR_TEXT_CLASS,
            (disabled || readOnly) && "cursor-default",
            className
          )}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleMentionKeyDown}
          onKeyUp={() => {
            scheduleMentionPickerUpdate();
          }}
        />
      </div>

      {imageChips.length > 0 ? (
        <MentionPicker
          visible={mentionPicker !== null}
          anchor={mentionPicker?.anchor ?? null}
          query={mentionPicker?.query ?? ""}
          chips={imageChips}
          activeIndex={mentionActiveIndex}
          thumbUrls={thumbUrls}
          onPick={handlePickMention}
          onActiveIndexChange={setMentionActiveIndex}
        />
      ) : null}

      {hoverPreview ? (
        <ReferenceHoverPreview
          chip={hoverPreview.chip}
          anchor={hoverPreview.anchor}
          thumbUrl={thumbUrls?.get(hoverPreview.chip.edgeId)}
        />
      ) : null}
    </>
  );
}
