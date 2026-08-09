import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";

import {
  STUDIO_SCROLL,
  STUDIO_TEXT_DETAIL_BODY,
  STUDIO_TEXT_VIEW_TOGGLE,
} from "./creative-studio-surface";
import { StudioTextFormattedView } from "./studio-text-formatted-view";
import { measureAutoTextareaHeight } from "./use-ai-text-output-scroll";

export type StudioTextViewMode = "formatted" | "raw";

export interface StudioTextOutputViewProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur: () => void;
  readonly onFocus: () => void;
  readonly onCompositionStart: () => void;
  readonly onCompositionEnd: () => void;
  readonly isEditing: boolean;
  readonly isGenerating: boolean;
  readonly editLocked: boolean;
  readonly maxLength: number;
  readonly placeholder?: string;
  readonly contentKey: string;
  readonly scrollContainerRef: RefObject<HTMLDivElement | null>;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly handleScroll: () => void;
  readonly scrollToTailIfAllowed: () => void;
  readonly className?: string;
}

export function StudioTextOutputView({
  value,
  onChange,
  onBlur,
  onFocus,
  onCompositionStart,
  onCompositionEnd,
  isEditing,
  isGenerating,
  editLocked,
  maxLength,
  placeholder,
  contentKey,
  scrollContainerRef,
  textareaRef,
  handleScroll,
  scrollToTailIfAllowed,
  className,
}: StudioTextOutputViewProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<StudioTextViewMode>("formatted");
  const [rawMounted, setRawMounted] = useState(false);
  const suppressBlurRef = useRef(false);
  const emptyEditRawAppliedRef = useRef(false);
  const isTextEditing = isEditing && !editLocked;
  const showFormatted = viewMode === "formatted";
  const showRaw = viewMode === "raw";
  const charCount = value.length;
  const isOverCharLimit = charCount > maxLength;

  const handleLeaveEdit = useCallback(() => {
    if (suppressBlurRef.current) {
      return;
    }
    onBlur();
  }, [onBlur]);

  const handleSelectViewMode = useCallback(
    (mode: StudioTextViewMode) => {
      if (isGenerating || mode === viewMode) {
        return;
      }

      suppressBlurRef.current = true;
      if (mode === "raw") {
        setRawMounted(true);
      }
      setViewMode(mode);

      window.requestAnimationFrame(() => {
        suppressBlurRef.current = false;
        if (!isTextEditing) {
          return;
        }
        if (mode === "raw") {
          textareaRef.current?.focus({ preventScroll: true });
          return;
        }
        const firstField = scrollContainerRef.current?.querySelector<
          HTMLTextAreaElement | HTMLElement
        >('textarea:not([readonly]), [contenteditable="true"]');
        firstField?.focus({ preventScroll: true });
      });
    },
    [isGenerating, isTextEditing, scrollContainerRef, textareaRef, viewMode]
  );

  useLayoutEffect(() => {
    if (!isTextEditing) {
      emptyEditRawAppliedRef.current = false;
      return;
    }
    if (emptyEditRawAppliedRef.current || value.trim()) {
      return;
    }
    emptyEditRawAppliedRef.current = true;
    setRawMounted(true);
    setViewMode("raw");
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
  }, [isTextEditing, value, textareaRef]);

  useLayoutEffect(() => {
    if (isTextEditing && showRaw) {
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [isTextEditing, showRaw, textareaRef]);

  useLayoutEffect(() => {
    if (!showRaw) {
      return;
    }
    const scrollContainer = scrollContainerRef.current;
    const textarea = textareaRef.current;
    if (!scrollContainer || !textarea) {
      return;
    }
    measureAutoTextareaHeight(textarea, scrollContainer);
  }, [showRaw, value, contentKey, scrollContainerRef, textareaRef]);

  useLayoutEffect(() => {
    if (!showFormatted || !isGenerating || isTextEditing) {
      return;
    }
    scrollToTailIfAllowed();
    const frameId = requestAnimationFrame(scrollToTailIfAllowed);
    return () => cancelAnimationFrame(frameId);
  }, [
    showFormatted,
    isGenerating,
    isTextEditing,
    value,
    contentKey,
    scrollToTailIfAllowed,
  ]);

  return (
    <div className={cn("relative h-full min-h-0", className)}>
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={cn(
          "relative h-full min-h-0 overflow-auto rounded-lg",
          STUDIO_SCROLL
        )}
      >
        <div className="relative min-h-full">
          <div
            className={cn(
              showFormatted
                ? "relative"
                : "pointer-events-none invisible absolute inset-x-0 top-0 -z-10"
            )}
            aria-hidden={!showFormatted}
          >
            <StudioTextFormattedView
              value={value}
              onChange={onChange}
              onBlur={isTextEditing ? handleLeaveEdit : undefined}
              onFocus={isTextEditing ? onFocus : undefined}
              readOnly={!isTextEditing}
              contentKey={contentKey}
              onLayoutUpdated={
                isGenerating && !isTextEditing ? scrollToTailIfAllowed : undefined
              }
            />
          </div>

          {rawMounted ? (
            <div
              className={cn(
                showRaw
                  ? "relative"
                  : "pointer-events-none invisible absolute inset-x-0 top-0 -z-10"
              )}
              aria-hidden={!showRaw}
            >
              <Textarea
                ref={textareaRef}
                data-studio-scroll-anchor={`${contentKey}-raw`}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onFocus={isTextEditing ? onFocus : undefined}
                onBlur={isTextEditing ? handleLeaveEdit : undefined}
                onCompositionStart={
                  isTextEditing ? onCompositionStart : undefined
                }
                onCompositionEnd={isTextEditing ? onCompositionEnd : undefined}
                readOnly={!isTextEditing || editLocked}
                maxLength={maxLength}
                placeholder={placeholder}
                className={cn(
                  STUDIO_TEXT_DETAIL_BODY,
                  !isTextEditing && "cursor-text"
                )}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        <div
          className="pointer-events-auto absolute bottom-3 left-3 flex items-center gap-2"
          onDoubleClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className={cn("flex gap-0.5", STUDIO_TEXT_VIEW_TOGGLE)}>
            <button
              type="button"
              disabled={isGenerating}
              aria-pressed={showFormatted}
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors disabled:opacity-40",
                showFormatted
                  ? "bg-background/90 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => handleSelectViewMode("formatted")}
            >
              {t("workflow.studio.textViewFormatted")}
            </button>
            <button
              type="button"
              disabled={isGenerating}
              aria-pressed={showRaw}
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors disabled:opacity-40",
                showRaw
                  ? "bg-background/90 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => handleSelectViewMode("raw")}
            >
              {t("workflow.studio.textViewRaw")}
            </button>
          </div>
          <div className={cn("flex", STUDIO_TEXT_VIEW_TOGGLE)}>
            <span
              className={cn(
                "select-none rounded px-2 py-1 text-xs tabular-nums",
                isOverCharLimit ? "text-destructive" : "text-muted-foreground"
              )}
              aria-label={t("workflow.studio.textCharCountAria", {
                count: charCount,
                max: maxLength,
              })}
            >
              {charCount} / {maxLength}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
