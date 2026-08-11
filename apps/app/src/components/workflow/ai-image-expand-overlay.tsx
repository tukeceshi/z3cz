import type { MediaReference, ObjectReference } from "@dafthunk/types";
import { createPortal } from "react-dom";
import Maximize2Icon from "lucide-react/icons/maximize-2";
import XIcon from "lucide-react/icons/x";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { Button } from "@/components/ui/button";
import { isMediaExpired } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import { MediaImageField } from "./fields/media-image-field";
import { WorkflowMediaVideoPlayer } from "./workflow-media-video-player";

function isVideoMedia(media: MediaReference): boolean {
  return media.mimeType.startsWith("video/");
}

interface ExpandMediaPreviewProps {
  readonly media: MediaReference;
  readonly createObjectUrl?: (objectReference: ObjectReference) => string;
}

function ExpandMediaPreview({
  media,
  createObjectUrl,
}: ExpandMediaPreviewProps) {
  const { t } = useTranslation();
  const expired = isMediaExpired(media);
  const { displayUrl, stale } = useMediaDisplayUrl({
    media: expired ? null : media,
    nodeType: isVideoMedia(media) ? "ai-video" : "ai-image",
    size: "full",
  });
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    setMediaError(false);
  }, [displayUrl]);

  if (stale || !displayUrl || mediaError) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
        {t("workflow.aiMediaCache.imageUnavailable")}
      </div>
    );
  }

  if (isVideoMedia(media)) {
    return (
      <div className="min-h-[320px] overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700">
        <WorkflowMediaVideoPlayer
          src={displayUrl}
          className="min-h-[320px]"
          objectFit="contain"
          variant="field"
          onError={() => setMediaError(true)}
        />
      </div>
    );
  }

  return (
    <MediaImageField
      value={media}
      createObjectUrl={createObjectUrl}
      className="min-h-[200px]"
    />
  );
}

export interface AiImageExpandOverlayProps {
  readonly open: boolean;
  readonly title: string;
  readonly images?: readonly MediaReference[];
  readonly media?: readonly MediaReference[];
  readonly createObjectUrl?: (objectReference: ObjectReference) => string;
  readonly onClose: () => void;
}

export function AiImageExpandOverlay({
  open,
  title,
  images,
  media,
  createObjectUrl,
  onClose,
}: AiImageExpandOverlayProps) {
  const { t } = useTranslation();
  const item = (media ?? images ?? [])[0];

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
          {item ? (
            <ExpandMediaPreview
              media={item}
              createObjectUrl={createObjectUrl}
            />
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
      title={t("workflow.studio.enter")}
    >
      <Maximize2Icon className="h-3 w-3 opacity-80" strokeWidth={2} />
    </button>
  );
}
