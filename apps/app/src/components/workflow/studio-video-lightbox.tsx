import XIcon from "lucide-react/icons/x";
import { createPortal } from "react-dom";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

import { WorkflowMediaVideoPlayer } from "./workflow-media-video-player";

export interface StudioVideoLightboxProps {
  readonly open: boolean;
  readonly src: string;
  readonly onClose: () => void;
}

export function StudioVideoLightbox({
  open,
  src,
  onClose,
}: StudioVideoLightboxProps) {
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/88 p-4"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 z-10 h-9 w-9 text-white hover:bg-white/10 hover:text-white"
        onClick={onClose}
      >
        <XIcon className="h-4 w-4" />
      </Button>
      <div
        className={cn(
          "nodrag nopan nowheel h-[min(92vh,720px)] w-[min(92vw,960px)] overflow-hidden rounded-xl bg-black"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <WorkflowMediaVideoPlayer
          key={src}
          src={src}
          variant="card"
          objectFit="contain"
          initialHovered
          className="size-full"
        />
      </div>
    </div>,
    document.body
  );
}
