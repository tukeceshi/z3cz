import type { AiImageResultHistory, MediaReference } from "@dafthunk/types";
import { getMediaReferenceKey } from "@dafthunk/types";
import { createPortal } from "react-dom";
import HistoryIcon from "lucide-react/icons/history";
import XIcon from "lucide-react/icons/x";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

import { MediaImageField } from "./fields/media-image-field";
import { LazyMediaImageField } from "./fields/lazy-media-image-field";

export interface AiImageHistoryOverlayProps {
  readonly open: boolean;
  readonly history: AiImageResultHistory;
  readonly currentImages: readonly MediaReference[];
  readonly createObjectUrl?: (objectReference: import("@dafthunk/types").ObjectReference) => string;
  readonly onSelect: (id: string) => void;
  readonly onClose: () => void;
}

function imagesMatch(
  a: readonly MediaReference[],
  b: readonly MediaReference[]
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (entry, index) =>
      getMediaReferenceKey(entry) === getMediaReferenceKey(b[index]!)
  );
}

export function AiImageHistoryOverlay({
  open,
  history,
  currentImages,
  createObjectUrl,
  onSelect,
  onClose,
}: AiImageHistoryOverlayProps) {
  const { t } = useTranslation();

  const matchingCurrent = history.items.filter((item) =>
    imagesMatch(item.images, currentImages)
  );
  const derivedCurrentId =
    matchingCurrent.length === 1
      ? matchingCurrent[0]?.id
      : history.selectedId &&
          matchingCurrent.some((item) => item.id === history.selectedId)
        ? history.selectedId
        : matchingCurrent[0]?.id;

  const [previewId, setPreviewId] = useState<string | null>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [listScrollRoot, setListScrollRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      setListScrollRoot(null);
      return;
    }
    setListScrollRoot(listScrollRef.current);
  }, [open, history.items.length]);

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
        <div className="flex w-[200px] shrink-0 flex-col border-r border-border bg-muted/30">
          <div className="border-b border-border px-3 py-3">
            <h3 className="text-sm font-medium">
              {t("workflow.aiImagePanel.historyTitle")}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("workflow.aiImagePanel.historyCount", { count: total })}
            </p>
          </div>
          <div
            ref={listScrollRef}
            className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2"
          >
            {history.items.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                {t("workflow.aiImagePanel.historyEmpty")}
              </p>
            ) : (
              history.items.map((item, index) => {
                const active = item.id === previewItem?.id;
                const isCurrent = item.id === derivedCurrentId;
                const ordinal = total - index;
                const thumb = item.images[0];
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
                      <div className="mb-1 h-[72px] w-[72px] overflow-hidden rounded">
                        {thumb ? (
                          <LazyMediaImageField
                            value={thumb}
                            createObjectUrl={createObjectUrl}
                            className="h-full w-full"
                            size="thumb"
                            scrollRoot={listScrollRoot}
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            {t("workflow.aiImagePanel.historyEmptyItem")}
                          </span>
                        )}
                      </div>
                      {item.prompt ? (
                        <span className="line-clamp-2 block text-[10px] text-muted-foreground">
                          {item.prompt}
                        </span>
                      ) : null}
                      {isCurrent ? (
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {t("workflow.aiImagePanel.historySelected")}
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
              {t("workflow.aiImagePanel.historyPreview")}
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
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {previewItem && previewItem.images.length > 0 ? (
              <div
                className={cn(
                  "grid gap-2",
                  previewItem.images.length === 1
                    ? "grid-cols-1"
                    : previewItem.images.length <= 4
                      ? "grid-cols-2"
                      : "grid-cols-3",
                  previewItem.prompt ? "mb-3" : undefined
                )}
              >
                {previewItem.images.map((img, idx) => (
                  <MediaImageField
                    key={getMediaReferenceKey(img) ?? idx}
                    value={img}
                    createObjectUrl={createObjectUrl}
                    className="w-full"
                    imageClassName="max-h-[min(52vh,480px)] object-contain"
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("workflow.aiImagePanel.historyEmpty")}
              </p>
            )}
            {previewItem?.prompt ? (
              <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("workflow.aiImagePanel.historyPrompt")}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">
                  {previewItem.prompt}
                </p>
              </div>
            ) : null}
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
              {t("workflow.aiImagePanel.historyApply")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AiImageHistoryButton({
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
      title={t("workflow.aiImagePanel.historyTitle")}
    >
      <span>{count}</span>
      <HistoryIcon className="h-2.5 w-2.5 opacity-80" strokeWidth={2} />
    </button>
  );
}
