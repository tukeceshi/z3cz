import { useEffect, useState } from "react";

import { WORKFLOW_SHIFT_HELD_ATTR } from "./workflow-canvas-styles";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (target == null || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

export function shouldBlockCardInteraction(
  shiftHeld: boolean,
  selectedNodeCount: number
): boolean {
  return shiftHeld || selectedNodeCount > 1;
}

function setShiftHeldAttr(held: boolean): void {
  if (held) {
    document.documentElement.setAttribute(WORKFLOW_SHIFT_HELD_ATTR, "true");
    return;
  }
  document.documentElement.removeAttribute(WORKFLOW_SHIFT_HELD_ATTR);
}

/** True while Shift is held or 2+ nodes are selected. */
export function useShiftSelectGate(selectedNodeCount: number): boolean {
  const [shiftHeld, setShiftHeld] = useState(false);

  useEffect(() => {
    const setHeld = (next: boolean) => {
      setShiftHeldAttr(next);
      setShiftHeld(next);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Shift") return;
      if (isTypingTarget(event.target)) return;
      setHeld(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Shift") return;
      setHeld(false);
    };

    const handleBlur = () => {
      setHeld(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      setShiftHeldAttr(false);
    };
  }, []);

  return shouldBlockCardInteraction(shiftHeld, selectedNodeCount);
}
