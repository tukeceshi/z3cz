import { createPortal } from "react-dom";
import HistoryIcon from "lucide-react/icons/history";
import XIcon from "lucide-react/icons/x";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";
import type { AiTextResultHistory } from "@dafthunk/types";

export interface AiTextHistoryOverlayProps {
  readonly open: boolean;
  readonly history: AiTextResultHistory;
  /** Current card output — used to mark which history row is active. */
  readonly currentOutput: string;
  readonly onSelect: (id: string) => void;
  readonly onClose: () => void;
}

export function AiTextHistoryOverlay({
  open,
  history,
  currentOutput,
  onSelect,
  onClose,
}: AiTextHistoryOverlayProps) {
  const { t } = useTranslation();

  const matchingCurrent = history.items.filter(
    (item) => item.text === currentOutput
  );
  const derivedCurrentId =
    matchingCurrent.length === 1
      ? matchingCurrent[0]?.id
      : history.selectedId &&
          matchingCurrent.some((item) => item.id === history.selectedId)
        ? history.selectedId
        : matchingCurrent[0]?.id;

  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPreviewId(derivedCurrentId ?? history.items[0]?.id ?? null);
  }, [open, derivedCurrentId, history.items]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const previewItem =
    history.items.find((item) => item.id === previewId) ?? history.items[0];
  const total = history.items.length;

  const handleApply = () => {
    if (!previewItem) return;
    onSelect(previewItem.id);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="nodrag nopan nowheel flex h-[min(85vh,720px)] w-[min(92vw,820px)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Left: numbered list */}
        <div className="flex w-[200px] shrink-0 flex-col border-r border-border bg-muted/30">
          <div className="border-b border-border px-3 py-3">
            <h3 className="text-sm font-medium">
              {t("workflow.aiTextPanel.historyTitle")}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("workflow.aiTextPanel.historyCount", { count: total })}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {history.items.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                {t("workflow.aiTextPanel.historyEmpty")}
              </p>
            ) : (
              history.items.map((item, index) => {
                const active = item.id === previewItem?.id;
                const isCurrent = item.id === derivedCurrentId;
                const ordinal = total - index;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg border px-2 py-2 text-left transition-colors",
                      active
                        ? "border-foreground/30 bg-background shadow-sm"
                        : "border-transparent hover:bg-background/70"
                    )}
                    onClick={() => setPreviewId(item.id)}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-medium",
                        active
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {ordinal}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-3 text-xs leading-snug text-foreground">
                        {item.text || t("workflow.aiTextPanel.historyEmptyItem")}
                      </span>
                      {isCurrent ? (
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {t("workflow.aiTextPanel.historySelected")}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: preview + actions */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium">
              {t("workflow.aiTextPanel.historyPreview")}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {previewItem ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {previewItem.text || t("workflow.aiTextPanel.historyEmptyItem")}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("workflow.aiTextPanel.historyEmpty")}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!previewItem}
              onClick={handleApply}
            >
              {t("workflow.aiTextPanel.historyApply")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Floating history pill — count + icon, like the reference site. */
export function AiTextHistoryButton({
  onClick,
  count,
  className,
}: {
  readonly onClick: () => void;
  readonly count: number;
  readonly className?: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={cn(
        "nodrag nopan flex h-6 shrink-0 items-center gap-1.5 rounded border px-2 py-1",
        "border-black/10 bg-black/25 text-xs font-normal tabular-nums leading-4 text-foreground/90",
        "backdrop-blur-[40px] transition hover:bg-black/40",
        "dark:border-white/10 dark:bg-black/30 dark:text-white dark:hover:bg-black/45",
        className
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={t("workflow.aiTextPanel.historyTitle")}
    >
      <span>{count}</span>
      <HistoryIcon className="h-2.5 w-2.5 opacity-80" strokeWidth={2} />
    </button>
  );
}
