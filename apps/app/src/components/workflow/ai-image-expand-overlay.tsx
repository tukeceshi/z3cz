import type { MediaReference } from "@dafthunk/types";
import { getMediaReferenceKey } from "@dafthunk/types";
import { createPortal } from "react-dom";
import Maximize2Icon from "lucide-react/icons/maximize-2";
import XIcon from "lucide-react/icons/x";
import { useEffect } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

import { MediaImageField } from "./fields/media-image-field";

export interface AiImageExpandOverlayProps {
  readonly open: boolean;
  readonly title: string;
  readonly images: readonly MediaReference[];
  readonly createObjectUrl?: (objectReference: import("@dafthunk/types").ObjectReference) => string;
  readonly onClose: () => void;
}

export function AiImageExpandOverlay({
  open,
  title,
  images,
  createObjectUrl,
  onClose,
}: AiImageExpandOverlayProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const gridCols =
    images.length === 1
      ? "grid-cols-1"
      : images.length <= 4
        ? "grid-cols-2"
        : "grid-cols-3";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "nodrag nopan nowheel flex flex-col rounded-lg border border-border bg-card shadow-lg",
          "h-[min(85vh,720px)] w-[min(92vw,820px)]"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium">{title}</p>
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
          {images.length > 0 ? (
            <div className={cn("grid gap-3", gridCols)}>
              {images.map((img, idx) => (
                <MediaImageField
                  key={getMediaReferenceKey(img) ?? idx}
                  value={img}
                  createObjectUrl={createObjectUrl}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("workflow.aiImagePanel.outputPlaceholder")}
            </p>
          )}
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button type="button" onClick={onClose}>
            {t("workflow.aiImagePanel.done")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AiImageExpandButton({
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
        "nodrag nopan flex h-6 w-6 shrink-0 items-center justify-center rounded border",
        "border-black/10 bg-black/25 text-foreground/90 backdrop-blur-[40px]",
        "transition hover:bg-black/40 dark:border-white/10 dark:bg-black/30 dark:text-white dark:hover:bg-black/45",
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
      title={t("workflow.aiImagePanel.expand")}
    >
      <Maximize2Icon className="h-3 w-3 opacity-80" strokeWidth={2} />
    </button>
  );
}
