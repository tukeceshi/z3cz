import { formatPlatformModelLabel } from "@dafthunk/types";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/utils/utils";

interface ModelAliasInlineEditProps {
  readonly alias: string;
  readonly modalityLabel: string;
  readonly disabled?: boolean;
  readonly onAliasChange?: (alias: string) => void;
}

export function ModelAliasInlineEdit({
  alias,
  modalityLabel,
  disabled = false,
  onAliasChange,
}: ModelAliasInlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(alias);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(alias);
    }
  }, [alias, editing]);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [editing]);

  const label = formatPlatformModelLabel({ alias, modalityLabel });

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === alias || !onAliasChange || disabled) {
      setDraft(alias);
      return;
    }
    onAliasChange(next);
  };

  const cancel = () => {
    setDraft(alias);
    setEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  if (!onAliasChange || disabled) {
    return <span className="font-medium">{label}</span>;
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-0.5 font-medium">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="h-7 w-40 border-border/60 bg-background px-2 text-sm font-medium shadow-none focus-visible:ring-1"
        />
        <span className="text-muted-foreground">（{modalityLabel}）</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "font-medium text-left underline-offset-2 hover:underline",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
      )}
      onClick={() => setEditing(true)}
    >
      {label}
    </button>
  );
}
