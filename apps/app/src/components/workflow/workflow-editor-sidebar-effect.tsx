import { useLayoutEffect } from "react";

import { useSidebar } from "@/components/ui/sidebar";
import {
  readSidebarBeforeEditor,
  readSidebarCookie,
  SIDEBAR_BEFORE_EDITOR_KEY,
  writeSidebarBeforeEditor,
} from "@/utils/sidebar-state";
import { isWorkflowWorkspacePath } from "@/utils/workflow-workspace-path";

/** Collapse org sidebar in the editor and restore the prior state on leave. */
export function WorkflowEditorSidebarEffect() {
  const { open, setOpen } = useSidebar();

  useLayoutEffect(() => {
    if (readSidebarBeforeEditor() === undefined) {
      const priorOpen = readSidebarCookie() ?? open;
      writeSidebarBeforeEditor(priorOpen);
    }

    if (open) {
      setOpen(false, { persist: false });
    }

    return () => {
      if (isWorkflowWorkspacePath(window.location.pathname)) {
        return;
      }

      const saved = readSidebarBeforeEditor();
      sessionStorage.removeItem(SIDEBAR_BEFORE_EDITOR_KEY);
      if (saved === undefined) {
        return;
      }

      setOpen(saved, { persist: true });
    };
  }, [setOpen]);

  return null;
}
