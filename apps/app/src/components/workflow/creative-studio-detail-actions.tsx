import DownloadIcon from "lucide-react/icons/download";
import HistoryIcon from "lucide-react/icons/history";
import Maximize2Icon from "lucide-react/icons/maximize-2";
import { useCallback, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

const STUDIO_ACTION_BUTTON_CLASSNAME =
  "nodrag nopan nowheel flex h-7 shrink-0 items-center gap-1 rounded-md border border-border/60 bg-background/90 px-2 text-[11px] font-medium text-foreground/80 shadow-sm backdrop-blur-sm transition hover:bg-muted dark:border-neutral-600 dark:bg-neutral-900/90 dark:hover:bg-neutral-800";

export function StudioHistoryActionButton({
  count,
  onClick,
  className,
}: {
  readonly count: number;
  readonly onClick: () => void;
  readonly className?: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={cn(STUDIO_ACTION_BUTTON_CLASSNAME, className)}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <HistoryIcon className="h-3 w-3 opacity-80" strokeWidth={2} />
      <span>{t("workflow.studio.history")}</span>
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

export function StudioDownloadActionButton({
  src,
  fileName,
  className,
}: {
  readonly src: string;
  readonly fileName: string;
  readonly className?: string;
}) {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(src, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(src, "_blank", "noopener,noreferrer");
    } finally {
      setIsDownloading(false);
    }
  }, [fileName, isDownloading, src]);

  return (
    <button
      type="button"
      disabled={isDownloading}
      className={cn(
        STUDIO_ACTION_BUTTON_CLASSNAME,
        isDownloading && "opacity-50",
        className
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        void handleDownload();
      }}
    >
      <DownloadIcon className="h-3 w-3 opacity-80" strokeWidth={2} />
      <span>{t("workflow.studio.download")}</span>
    </button>
  );
}

export function StudioViewToolbarButton({
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
      className={cn(STUDIO_ACTION_BUTTON_CLASSNAME, className)}
      title={t("workflow.studio.viewImage")}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Maximize2Icon className="h-3 w-3 opacity-80" strokeWidth={2} />
      <span>{t("workflow.studio.viewImage")}</span>
    </button>
  );
}
