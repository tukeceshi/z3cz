import { useEffect, useRef } from "react";

import { useSidebar } from "@/components/ui/sidebar";

/** Collapse org sidebar on workflow editor mount; restore prior state on leave. */
export function WorkflowEditorSidebarEffect() {
  const { open, setOpen } = useSidebar();
  const previousOpenRef = useRef(open);

  useEffect(() => {
    setOpen(false);
    return () => {
      setOpen(previousOpenRef.current);
    };
  }, [setOpen]);

  return null;
}
