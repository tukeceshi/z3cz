import { useEffect, useState } from "react";

interface UseNumericDraftInputParams {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onCommit: (value: number) => void;
}

export function useNumericDraftInput({
  value,
  min,
  max,
  onCommit,
}: UseNumericDraftInputParams) {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return {
    value: draft,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      if (next === "" || /^\d+$/.test(next)) {
        setDraft(next);
      }
    },
    onBlur: () => {
      const trimmed = draft.trim();
      if (trimmed === "") {
        setDraft(String(value));
        return;
      }

      const parsed = Math.floor(Number(trimmed));
      if (!Number.isFinite(parsed)) {
        setDraft(String(value));
        return;
      }

      const clamped = Math.max(min, Math.min(parsed, max));
      setDraft(String(clamped));
      onCommit(clamped);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.currentTarget.blur();
      }
    },
  };
}
