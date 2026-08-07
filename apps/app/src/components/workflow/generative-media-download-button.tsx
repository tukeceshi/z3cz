import type { MediaReference } from "@dafthunk/types";
import DownloadIcon from "lucide-react/icons/download";
import { useCallback, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { resolveResourceDisplayUrl } from "@/services/resolve-resource-display-url";
import { ingestCanvasMedia } from "@/services/ingest-canvas-media";
import { cn } from "@/utils/utils";

export const GENERATIVE_CARD_OVERLAY_BUTTON_CLASSNAME =
  "rounded border border-black/10 bg-black/25 text-foreground/90 backdrop-blur-[40px] hover:bg-black/40 dark:border-white/10 dark:bg-black/30 dark:text-white dark:hover:bg-black/45";

export function GenerativeMediaDownloadButton({
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
        "nodrag nopan nowheel flex h-6 w-6 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white",
        isDownloading && "opacity-50",
        className
      )}
      aria-label={t("workflow.aiAudioPanel.download")}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        void handleDownload();
      }}
    >
      <DownloadIcon className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}

/** Resolves full-size blob URL on click — avoids a second display hook on the card. */
export function GenerativeMediaLazyDownloadButton({
  media,
  nodeType,
  fileName,
  className,
}: {
  readonly media: MediaReference;
  readonly nodeType: "ai-image" | "ai-video" | "ai-audio";
  readonly fileName: string;
  readonly className?: string;
}) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id ?? "";
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (isDownloading || !orgId || !workflowId) return;
    setIsDownloading(true);
    try {
      await ingestCanvasMedia({
        organizationId: orgId,
        workflowId,
        media,
        nodeType,
      });
      const src = await resolveResourceDisplayUrl({
        media,
        organizationId: orgId,
        workflowId,
        nodeType,
        size: "full",
      });
      if (!src) {
        throw new Error("Media not available locally");
      }
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
      // Best-effort: user can retry after cache warm.
    } finally {
      setIsDownloading(false);
    }
  }, [fileName, isDownloading, media, nodeType, orgId, workflowId]);

  return (
    <button
      type="button"
      disabled={isDownloading}
      className={cn(
        "nodrag nopan nowheel flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white",
        isDownloading && "opacity-50",
        className
      )}
      aria-label={t("workflow.aiAudioPanel.download")}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        void handleDownload();
      }}
    >
      <DownloadIcon className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}
