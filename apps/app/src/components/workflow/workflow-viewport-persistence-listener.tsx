import { useEffect, useRef, type RefObject } from "react";
import { useOnViewportChange, type Viewport } from "@xyflow/react";

import { isValidWorkflowEditorViewport } from "./workflow-viewport-utils";

const VIEWPORT_PERSIST_DEBOUNCE_MS = 300;

export interface WorkflowViewportPersistenceListenerProps {
  readonly disabled?: boolean;
  readonly onViewportEnd?: (viewport: Viewport) => void;
  readonly suppressNextEndRef?: RefObject<boolean>;
}

/** Persists pan + zoom (scroll zoom uses onChange; pan uses onChange + onEnd). */
export function WorkflowViewportPersistenceListener({
  disabled = false,
  onViewportEnd,
  suppressNextEndRef,
}: WorkflowViewportPersistenceListenerProps) {
  const debounceTimerRef = useRef<number | null>(null);
  const latestViewportRef = useRef<Viewport | null>(null);

  const persistViewport = (viewport: Viewport, immediate: boolean) => {
    if (disabled || !onViewportEnd || !isValidWorkflowEditorViewport(viewport)) {
      return;
    }

    if (suppressNextEndRef?.current) {
      if (immediate) {
        suppressNextEndRef.current = false;
      }
      return;
    }

    latestViewportRef.current = viewport;

    if (immediate) {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      onViewportEnd(viewport);
      return;
    }

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      const pending = latestViewportRef.current;
      if (pending && isValidWorkflowEditorViewport(pending)) {
        onViewportEnd(pending);
      }
    }, VIEWPORT_PERSIST_DEBOUNCE_MS);
  };

  useOnViewportChange({
    onChange: (viewport) => {
      if (viewport == null) {
        return;
      }
      persistViewport(viewport, false);
    },
    onEnd: (viewport) => {
      if (viewport == null) {
        return;
      }
      persistViewport(viewport, true);
    },
  });

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return null;
}
