import {
  useCallback,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";

import {
  isNearScrollBottom,
  scrollContainerToBottom,
  scrollContainerToTop,
} from "./ai-text-preview-scroll";
import {
  applyStudioTextScrollRestore,
  captureStudioTextScrollRestore,
  type StudioTextScrollRestore,
} from "./studio-text-scroll-anchor";

export type AiTextOutputScrollVariant = "studio-detail" | "canvas-card";

export interface UseAiTextOutputScrollOptions {
  readonly text: string;
  readonly isGenerating: boolean;
  /** Changes reset scroll state (node id, history selection, …). */
  readonly contentKey: string;
  readonly variant: AiTextOutputScrollVariant;
  readonly isEditing?: boolean;
  /** Canvas: keep tail visible after generate while node stays selected. */
  readonly holdTailAfterComplete?: boolean;
}

export interface UseAiTextOutputScrollResult {
  readonly scrollContainerRef: RefObject<HTMLDivElement | null>;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly handleScroll: () => void;
  readonly rememberScrollForEdit: () => void;
  readonly scrollToTailIfAllowed: () => void;
  readonly tailPreview: boolean;
}

type ScrollPhase = "idle" | "stream-start" | "streaming" | "stream-done";

export function measureAutoTextareaHeight(
  textarea: HTMLTextAreaElement,
  scrollContainer: HTMLElement
): number {
  const minHeight = scrollContainer.clientHeight;
  textarea.style.height = "0px";
  const collapsedHeight = textarea.scrollHeight;
  textarea.style.height = `${Math.max(collapsedHeight, minHeight)}px`;
  return Math.max(textarea.scrollHeight, collapsedHeight, minHeight);
}

function resolveScrollPhase(params: {
  readonly isGenerating: boolean;
  readonly text: string;
  readonly streamStarted: boolean;
  readonly streamEnded: boolean;
  readonly holdTailAfterComplete: boolean;
  readonly variant: AiTextOutputScrollVariant;
}): ScrollPhase {
  if (params.streamStarted || (params.isGenerating && params.text.length === 0)) {
    return "stream-start";
  }

  if (params.isGenerating && params.text.length > 0) {
    return "streaming";
  }

  if (params.streamEnded) {
    return "stream-done";
  }

  if (params.variant === "canvas-card" && params.holdTailAfterComplete) {
    return "stream-done";
  }

  return "idle";
}

export function useAiTextOutputScroll({
  text,
  isGenerating,
  contentKey,
  variant,
  isEditing = false,
  holdTailAfterComplete = false,
}: UseAiTextOutputScrollOptions): UseAiTextOutputScrollResult {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamPinnedRef = useRef(false);
  const pendingScrollRestoreRef = useRef<StudioTextScrollRestore | null>(null);
  const prevGeneratingRef = useRef(isGenerating);
  const prevContentKeyRef = useRef(contentKey);

  const tailPreview =
    variant === "canvas-card" && (isGenerating || holdTailAfterComplete);

  const rememberScrollForEdit = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }
    pendingScrollRestoreRef.current =
      captureStudioTextScrollRestore(scrollContainer);
  }, []);

  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !isGenerating || isEditing) return;
    streamPinnedRef.current = !isNearScrollBottom(scrollContainer);
  }, [isEditing, isGenerating]);

  const scrollToTailIfAllowed = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || streamPinnedRef.current) return;
    scrollContainerToBottom(scrollContainer);
  }, []);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const textarea = textareaRef.current;
    if (!scrollContainer) return;

    const contentKeyChanged = prevContentKeyRef.current !== contentKey;
    const streamStarted = isGenerating && !prevGeneratingRef.current;
    const streamEnded = !isGenerating && prevGeneratingRef.current;

    if (contentKeyChanged || streamStarted) {
      streamPinnedRef.current = false;
      if (contentKeyChanged) {
        pendingScrollRestoreRef.current = null;
      }
    }

    prevGeneratingRef.current = isGenerating;
    prevContentKeyRef.current = contentKey;

    if (variant === "canvas-card" && textarea) {
      if (streamStarted || (isGenerating && text.length === 0)) {
        textarea.style.height = "0px";
        scrollContainer.scrollTop = 0;
      }
      textarea.style.height = `${measureAutoTextareaHeight(textarea, scrollContainer)}px`;
    }

    const pendingRestore = pendingScrollRestoreRef.current;
    if (pendingRestore) {
      applyStudioTextScrollRestore(scrollContainer, pendingRestore);
      pendingScrollRestoreRef.current = null;
      return;
    }

    if (isEditing) {
      return;
    }

    const phase = resolveScrollPhase({
      isGenerating,
      text,
      streamStarted,
      streamEnded,
      holdTailAfterComplete,
      variant,
    });

    switch (phase) {
      case "stream-start":
      case "idle":
        scrollContainerToTop(scrollContainer);
        break;
      case "streaming":
        if (!streamPinnedRef.current) {
          scrollContainerToBottom(scrollContainer);
        }
        break;
      case "stream-done":
        scrollContainerToBottom(scrollContainer);
        break;
    }
  }, [
    contentKey,
    holdTailAfterComplete,
    isEditing,
    isGenerating,
    text,
    variant,
  ]);

  return {
    scrollContainerRef,
    textareaRef,
    handleScroll,
    rememberScrollForEdit,
    scrollToTailIfAllowed,
    tailPreview,
  };
}
