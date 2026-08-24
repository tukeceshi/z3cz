import { createPortal } from "react-dom";
import HistoryIcon from "lucide-react/icons/history";
import LoaderIcon from "lucide-react/icons/loader-circle";
import XIcon from "lucide-react/icons/x";
import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";
import { buildAiTextExcerpt, type AiTextResultHistory } from "@dafthunk/types";
import { readAiTextFullBodyFromStaging } from "@/services/ai-text-cache-layer";

import { STUDIO_SCROLL } from "./creative-studio-surface";

export interface AiTextHistoryOverlayProps {
  readonly open: boolean;
  readonly history: AiTextResultHistory;
  readonly currentId?: string | null;
  readonly organizationId?: string;
  readonly workflowId?: string;
  readonly onSelect: (id: string) => void;
  readonly onClose: () => void;
}

export function AiTextHistoryOverlay({
  open,
  history,
  currentId,
  organizationId,
  workflowId,
  onSelect,
  onClose,
}: AiTextHistoryOverlayProps) {
  const { t } = useTranslation();
  const selectedId = currentId ?? history.selectedId;
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Readonly<Record<string, string>>>({});
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  const itemKey = useMemo(
    () => history.items.map((item) => item.id).join("|"),
    [history.items]
  );

  useEffect(() => {
    if (!open) return;
    setPreviewId(selectedId ?? history.items[0]?.id ?? null);
  }, [open, selectedId, itemKey, history.items]);

  useEffect(() => {
    if (!open || !organizationId || !workflowId) {
      return;
    }

    let cancelled = false;
    const missing = history.items.filter(
      (item) => Boolean(item.resourceId) && !item.text?.trim()
    );

    if (missing.length === 0) {
      return;
    }

    setLoadingIds(new Set(missing.map((item) => item.id)));

    void (async () => {
      const loaded: Record<string, string> = {};
      await Promise.all(
        missing.map(async (item) => {
          if (!item.resourceId) {
            loaded[item.id] = "";
            return;
          }
          const body =
            (await readAiTextFullBodyFromStaging({
              organizationId,
              workflowId,
              reference: {
                resourceId: item.resourceId,
                contentSha256: item.contentSha256,
                mimeType: "text/plain; charset=utf-8",
              },
              workflowSha: item.contentSha256,
            })) ?? "";
          loaded[item.id] = body;
        })
      );

      if (cancelled) {
        return;
      }

      setBodies((current) => ({ ...current, ...loaded }));
      setLoadingIds(new Set());
    })();

    return () => {
      cancelled = true;
    };
  }, [history.items, open, organizationId, workflowId]);

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

  const readItemBody = (itemId: string): string => {
    const item = history.items.find((entry) => entry.id === itemId);
    if (item?.text?.trim()) {
      return item.text;
    }
    return bodies[itemId] ?? "";
  };

  const handleApply = () => {
    if (!previewItem) return;
    onSelect(previewItem.id);
    onClose();
  };

  const previewBody = previewItem ? readItemBody(previewItem.id) : "";
  const previewLoading = previewItem
    ? loadingIds.has(previewItem.id) && !previewBody
    : false;

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
        <div className="flex w-[200px] shrink-0 flex-col border-r border-border bg-muted/30">
          <div className="border-b border-border px-3 py-3">
            <h3 className="text-sm font-medium">
              {t("workflow.aiTextPanel.historyTitle")}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("workflow.aiTextPanel.historyCount", { count: total })}
            </p>
          </div>
          <div className={cn("min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2", STUDIO_SCROLL)}>
            {history.items.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                {t("workflow.aiTextPanel.historyEmpty")}
              </p>
            ) : (
              history.items.map((item, index) => {
                const active = item.id === previewItem?.id;
                const isCurrent = item.id === selectedId;
                const ordinal = total - index;
                const body = readItemBody(item.id);
                const excerpt = body ? buildAiTextExcerpt(body) : "";
                const itemLoading = loadingIds.has(item.id) && !body;
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
                        {itemLoading
                          ? t("workflow.aiTextPanel.historyLoadingItem")
                          : excerpt || t("workflow.aiTextPanel.historyEmptyItem")}
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
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", STUDIO_SCROLL)}>
            {previewItem ? (
              previewLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                  {t("workflow.aiTextPanel.historyLoadingItem")}
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {previewBody || t("workflow.aiTextPanel.historyEmptyItem")}
                </p>
              )
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
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
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
