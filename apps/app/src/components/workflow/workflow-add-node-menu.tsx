import type { AiGenerativeNodeType } from "@dafthunk/types";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/utils/utils";

import type { AddNodeConnectionDragHandle } from "./workflow-add-node-connection";
import { WorkflowAddNodeMenuPanel } from "./workflow-add-node-menu-panel";

export interface WorkflowAddNodeMenuState {
  readonly screenX: number;
  readonly screenY: number;
  readonly flowX: number;
  readonly flowY: number;
  readonly sourceContext?: {
    readonly nodeId: string;
    readonly handle: AddNodeConnectionDragHandle;
  };
}

interface WorkflowAddNodeMenuProps {
  readonly state: WorkflowAddNodeMenuState | null;
  readonly onSelect: (
    nodeType: AiGenerativeNodeType,
    menu: WorkflowAddNodeMenuState
  ) => void;
  readonly onClose: () => void;
}

export function WorkflowAddNodeMenu({
  state,
  onSelect,
  onClose,
}: WorkflowAddNodeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, state]);

  const handleSelect = useCallback(
    (nodeType: AiGenerativeNodeType) => {
      if (!state) {
        return;
      }
      onSelect(nodeType, state);
      onClose();
    },
    [onClose, onSelect, state]
  );

  if (!state) {
    return null;
  }

  const menuWidth = 168;
  const menuHeight = 220;
  const viewportPadding = 8;
  const left = Math.min(
    Math.max(state.screenX, viewportPadding),
    window.innerWidth - menuWidth - viewportPadding
  );
  const top = Math.min(
    Math.max(state.screenY, viewportPadding),
    window.innerHeight - menuHeight - viewportPadding
  );

  return createPortal(
    <div
      ref={menuRef}
      className={cn("fixed z-50")}
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <WorkflowAddNodeMenuPanel onSelect={handleSelect} />
    </div>,
    document.body
  );
}
