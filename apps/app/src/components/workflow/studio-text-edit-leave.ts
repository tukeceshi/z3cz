import { useCallback, useRef, type FocusEvent, type RefObject } from "react";

/** True when focus moved outside `container` (handles null relatedTarget). */
export function shouldLeaveStudioTextEditSurface(
  container: HTMLElement | null,
  nextTarget: EventTarget | null
): boolean {
  if (!container) {
    return true;
  }
  if (nextTarget instanceof Node && container.contains(nextTarget)) {
    return false;
  }
  return true;
}

export interface UseStudioTextEditLeaveOptions {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly readOnly: boolean;
  readonly onLeave?: () => void;
}

export function useStudioTextEditLeave({
  containerRef,
  readOnly,
  onLeave,
}: UseStudioTextEditLeaveOptions) {
  const leaveTimerRef = useRef<number | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const scheduleLeaveCheck = useCallback(() => {
    if (readOnly || !onLeave) {
      return;
    }
    clearLeaveTimer();
    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = null;
      const active = document.activeElement;
      if (!shouldLeaveStudioTextEditSurface(containerRef.current, active)) {
        return;
      }
      onLeave();
    }, 0);
  }, [clearLeaveTimer, containerRef, onLeave, readOnly]);

  const handleFocusOut = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (readOnly || !onLeave) {
        return;
      }
      const nextTarget = event.relatedTarget;
      if (!shouldLeaveStudioTextEditSurface(containerRef.current, nextTarget)) {
        return;
      }
      scheduleLeaveCheck();
    },
    [containerRef, onLeave, readOnly, scheduleLeaveCheck]
  );

  return { handleFocusOut, scheduleLeaveCheck, clearLeaveTimer };
}
