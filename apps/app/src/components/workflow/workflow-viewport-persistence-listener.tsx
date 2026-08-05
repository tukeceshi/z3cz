import { type RefObject } from "react";
import { useOnViewportChange, type Viewport } from "@xyflow/react";

import { isValidWorkflowEditorViewport } from "./workflow-viewport-utils";

export interface WorkflowViewportPersistenceListenerProps {
  readonly disabled?: boolean;
  /** Fires on every viewport change while the user pans or zooms. */
  readonly onViewportChange?: (viewport: Viewport) => void;
  /** Fires when a pan/pinch gesture ends; use to flush persistence immediately. */
  readonly onViewportGestureEnd?: (viewport: Viewport) => void;
  readonly suppressNextEndRef?: RefObject<boolean>;
}

/** Forwards pan + zoom to persistence callbacks (scroll zoom uses onChange; pan uses onChange + onEnd). */
export function WorkflowViewportPersistenceListener({
  disabled = false,
  onViewportChange,
  onViewportGestureEnd,
  suppressNextEndRef,
}: WorkflowViewportPersistenceListenerProps) {
  const notifyChange = (viewport: Viewport) => {
    if (
      disabled ||
      !onViewportChange ||
      !isValidWorkflowEditorViewport(viewport)
    ) {
      return;
    }
    onViewportChange(viewport);
  };

  const notifyGestureEnd = (viewport: Viewport) => {
    if (
      disabled ||
      !isValidWorkflowEditorViewport(viewport)
    ) {
      return;
    }

    if (suppressNextEndRef?.current) {
      suppressNextEndRef.current = false;
      return;
    }

    onViewportChange?.(viewport);
    onViewportGestureEnd?.(viewport);
  };

  useOnViewportChange({
    onChange: (viewport) => {
      if (viewport == null) {
        return;
      }
      notifyChange(viewport);
    },
    onEnd: (viewport) => {
      if (viewport == null) {
        return;
      }
      notifyGestureEnd(viewport);
    },
  });

  return null;
}
