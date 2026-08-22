import XIcon from "lucide-react/icons/x";
import { createPortal } from "react-dom";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

import { useWorkflowVideoFrameCapture } from "./use-workflow-video-frame-capture";
import { WorkflowMediaVideoPlayer } from "./workflow-media-video-player";

export interface StudioVideoLightboxProps {
  readonly open: boolean;
  readonly src: string;
  readonly nodeId?: string;
  readonly onClose: () => void;
}

export function StudioVideoLightbox({
  open,
  src,
  nodeId,
  onClose,
}: StudioVideoLightboxProps) {
  const frameCapture = useWorkflowVideoFrameCapture(nodeId);

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
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/88 p-4"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "nodrag nopan nowheel relative h-[min(92vh,720px)] w-[min(92vw,960px)] overflow-hidden rounded-xl bg-black"
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-30 h-9 w-9 text-white hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <XIcon className="h-4 w-4" />
        </Button>
        <WorkflowMediaVideoPlayer
          key={src}
          src={src}
          variant="card"
          objectFit="contain"
          initialHovered
          className="size-full"
          showFrameCapture={frameCapture.showFrameCapture}
          frameCaptureDisabled={frameCapture.frameCaptureDisabled}
          videoRef={frameCapture.videoRef}
          onFrameCapture={frameCapture.onFrameCapture}
          menuContentClassName="z-[260]"
        />
      </div>
    </div>,
    document.body
  );
}
