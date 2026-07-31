import type {
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "@xyflow/react";
import { useEffect } from "react";

import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

interface UseKeyboardShortcutsProps {
  disabled: boolean;
  clipboardDisabled?: boolean;
  selectedNodes: ReactFlowNode<WorkflowNodeType>[];
  selectedEdges: ReactFlowEdge<WorkflowEdgeType>[];
  hasClipboardData: boolean;
  copySelected: () => void;
  cutSelected: () => void;
  pasteFromClipboard: () => void;
  duplicateSelected: () => void;
  requestDeleteSelected?: () => void;
  onAction?: (e: React.MouseEvent) => void;
  nodeCount: number;
}

/** True when the user has a non-empty DOM text selection (browser copy/cut should win). */
export function hasDomTextSelection(
  selection: Selection | null = typeof window !== "undefined"
    ? window.getSelection()
    : null
): boolean {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }
  return selection.toString().length > 0;
}

/**
 * Side-effect-only hook that registers global keyboard shortcuts
 * for clipboard (Cmd+C/X/V/D), delete (Delete/Backspace), and run (Cmd+Enter).
 */
export function useKeyboardShortcuts({
  disabled,
  clipboardDisabled = disabled,
  selectedNodes,
  selectedEdges,
  hasClipboardData,
  copySelected,
  cutSelected,
  pasteFromClipboard,
  duplicateSelected,
  requestDeleteSelected,
  onAction,
  nodeCount,
}: UseKeyboardShortcutsProps): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore when typing in input fields
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInputField) return;

      const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0;
      const isMac = /mac/i.test(navigator.userAgent);
      const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

      if (
        !isCtrlOrCmd &&
        !disabled &&
        requestDeleteSelected &&
        hasSelection &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        requestDeleteSelected();
        return;
      }

      if (!isCtrlOrCmd) return;

      // Cmd+Enter — execute workflow
      if (event.key === "Enter") {
        event.preventDefault();
        if (onAction && !disabled && nodeCount > 0) {
          const syntheticEvent = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
          }) as unknown as React.MouseEvent;
          onAction(syntheticEvent);
        }
        return;
      }

      // Prefer native copy/cut when the user selected text in browse mode.
      const preferNativeTextClipboard =
        (event.key.toLowerCase() === "c" || event.key.toLowerCase() === "x") &&
        hasDomTextSelection();

      if (preferNativeTextClipboard) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "c":
          if (!clipboardDisabled && hasSelection) {
            event.preventDefault();
            copySelected();
          }
          break;
        case "x":
          if (!clipboardDisabled && hasSelection) {
            event.preventDefault();
            cutSelected();
          }
          break;
        case "v":
          if (!clipboardDisabled && hasClipboardData) {
            event.preventDefault();
            pasteFromClipboard();
          }
          break;
        case "d":
          if (!clipboardDisabled && hasSelection) {
            event.preventDefault();
            duplicateSelected();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    clipboardDisabled,
    disabled,
    selectedNodes,
    selectedEdges,
    hasClipboardData,
    copySelected,
    cutSelected,
    pasteFromClipboard,
    duplicateSelected,
    requestDeleteSelected,
    onAction,
    nodeCount,
  ]);
}
