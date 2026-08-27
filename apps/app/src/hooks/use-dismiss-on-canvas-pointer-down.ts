import { useEffect, useRef } from "react";

const CANVAS_POINTER_DISMISS_SELECTORS = [
  ".react-flow__pane",
  ".react-flow__renderer",
] as const;

function isCanvasPointerDismissTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return CANVAS_POINTER_DISMISS_SELECTORS.some((selector) =>
    target.closest(selector)
  );
}

/** Closes overlays when the user clicks empty canvas space (React Flow pane). */
export function useDismissOnCanvasPointerDown(
  active: boolean,
  onDismiss: () => void
): void {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!active) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!isCanvasPointerDismissTarget(event.target)) {
        return;
      }
      onDismissRef.current();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [active]);
}
