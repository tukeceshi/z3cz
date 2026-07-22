import { useLayoutEffect, useRef } from "react";

import { useSidebar } from "@/components/ui/sidebar";
import {
  SIDEBAR_BEFORE_EDITOR_KEY,
  SIDEBAR_RESTORE_ON_MOUNT_KEY,
  writeSidebarCookie,
} from "@/utils/sidebar-state";

/** Collapse org sidebar in the editor and restore the prior state on leave. */
export function WorkflowEditorSidebarEffect() {
  const { open, setOpen } = useSidebar();
  const initialOpenRef = useRef(open);

  useLayoutEffect(() => {
    const previousOpen = initialOpenRef.current;
    sessionStorage.setItem(SIDEBAR_BEFORE_EDITOR_KEY, String(previousOpen));
    if (previousOpen) {
      setOpen(false, { persist: false });
    }

    return () => {
      const saved = sessionStorage.getItem(SIDEBAR_BEFORE_EDITOR_KEY);
      sessionStorage.removeItem(SIDEBAR_BEFORE_EDITOR_KEY);
      if (saved !== null) {
        sessionStorage.setItem(SIDEBAR_RESTORE_ON_MOUNT_KEY, saved);
        writeSidebarCookie(saved === "true");
      }
    };
  }, [setOpen]);

  return null;
}
