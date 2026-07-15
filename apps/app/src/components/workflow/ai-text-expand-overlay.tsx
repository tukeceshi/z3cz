import { createPortal } from "react-dom";
import Maximize2Icon from "lucide-react/icons/maximize-2";
import XIcon from "lucide-react/icons/x";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/utils";

export interface AiTextExpandOverlayProps {
  readonly open: boolean;
  readonly title: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onClose: () => void;
  readonly readOnly?: boolean;
  readonly maxLength?: number;
  readonly placeholder?: string;
}

export function AiTextExpandOverlay({
  open,
  title,
  value,
  onChange,
  onClose,
  readOnly = false,
  maxLength,
  placeholder,
}: AiTextExpandOverlayProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const handleApply = () => {
    if (!readOnly) {
      onChange(draft);
    }
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          handleApply();
        }
      }}
    >
      <div
        className={cn(
          "nodrag nopan nowheel flex flex-col rounded-lg border border-border bg-card shadow-lg",
          "h-[65vh] w-[70vw] max-w-5xl"
        )}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleApply}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            readOnly={readOnly}
            maxLength={maxLength}
            placeholder={placeholder}
            className="min-h-0 flex-1 resize-none text-sm"
          />
          {maxLength ? (
            <p className="text-right text-xs text-muted-foreground">
              {draft.length} / {maxLength}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end border-t px-4 py-2">
          <Button type="button" size="sm" onClick={handleApply}>
            {t("workflow.aiTextPanel.done")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Floating expand control — larger hit area, smaller icon, hover feedback. */
export function AiTextExpandButton({
  onClick,
  className,
}: {
  readonly onClick: () => void;
  readonly className?: string;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={cn(
        "nodrag nopan flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
        "border border-black/10 bg-black/20 text-foreground/80 backdrop-blur-md",
        "transition hover:scale-105 hover:bg-black/35 hover:text-foreground",
        "dark:border-white/15 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/20 dark:hover:text-white",
        className
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={t("workflow.aiTextPanel.expand")}
    >
      <Maximize2Icon className="h-2.5 w-2.5" strokeWidth={2} />
    </button>
  );
}
