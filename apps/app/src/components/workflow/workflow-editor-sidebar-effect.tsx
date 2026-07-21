import { useEffect, useRef } from "react";

import { useSidebar } from "@/components/ui/sidebar";

/** Restore org sidebar state when leaving the workflow editor. */
export function WorkflowEditorSidebarEffect() {
  const { open, setOpen } = useSidebar();
  const previousOpenRef = useRef(open);

  useEffect(() => {
    return () => {
      setOpen(previousOpenRef.current);
    };
  }, [setOpen]);

  return null;
}
