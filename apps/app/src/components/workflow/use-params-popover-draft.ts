import { useCallback, useRef, useState } from "react";

import { paramRecordsEqual } from "./generative-workflow-param-defaults";

/** Draft while open; commit on close only when values changed. */
export function useParamsPopoverDraft(
  values: Readonly<Record<string, unknown>>,
  onCommit: (next: Record<string, unknown>) => void
): {
  readonly open: boolean;
  readonly draft: Record<string, unknown>;
  readonly updateDraft: (next: Record<string, unknown>) => void;
  readonly handleOpenChange: (nextOpen: boolean) => void;
} {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({
    ...values,
  }));
  const openedAtRef = useRef<Record<string, unknown>>({ ...values });
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const updateDraft = useCallback((next: Record<string, unknown>) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        const snapshot = { ...values };
        openedAtRef.current = snapshot;
        draftRef.current = snapshot;
        setDraft(snapshot);
        setOpen(true);
        return;
      }

      const next = draftRef.current;
      if (!paramRecordsEqual(openedAtRef.current, next)) {
        onCommit(next);
      }
      setOpen(false);
    },
    [onCommit, values]
  );

  return { open, draft, updateDraft, handleOpenChange };
}
