import {
  isMediaReference,
  type MediaReference,
} from "@dafthunk/types";
import Image from "lucide-react/icons/image";
import LoaderIcon from "lucide-react/icons/loader-circle";
import Play from "lucide-react/icons/play";
import Video from "lucide-react/icons/video";
import { useState, type ReactNode } from "react";

import { cn } from "@/utils/utils";

import { readAiImageCardImages } from "./ai-image-node-utils";
import { readAiVideoCardVideos } from "./ai-video-node-utils";
import {
  STUDIO_MEDIA_PREVIEW,
  STUDIO_MEDIA_PREVIEW_MEDIA,
  STUDIO_MEDIA_PREVIEW_PLACEHOLDER,
  STUDIO_MEDIA_PREVIEW_VIDEO,
} from "./creative-studio-surface";
import type { WorkflowNodeType } from "./workflow-types";

const DEFAULT_ASPECT_RATIO = 16 / 9;

interface CreativeStudioMediaPreviewSlotProps {
  readonly aspectRatio: number;
  readonly className?: string;
  readonly children: ReactNode;
  readonly videoSurface?: boolean;
}

function CreativeStudioMediaPreviewSlot({
  aspectRatio,
  className,
  children,
  videoSurface = false,
}: CreativeStudioMediaPreviewSlotProps) {
  return (
    <div
      className={cn(
        STUDIO_MEDIA_PREVIEW,
        videoSurface ? STUDIO_MEDIA_PREVIEW_VIDEO : undefined,
        "w-full",
        className
      )}
      style={{ aspectRatio }}
    >
      {children}
    </div>
  );
}

export interface CreativeStudioMediaPreviewFrameProps {
  readonly media: MediaReference | null;
  readonly displayUrl: string | null;
  readonly stale: boolean;
  readonly isVideo: boolean;
  readonly referenceDragEnabled?: boolean;
  readonly fallbackMessage?: string;
  readonly fallbackBusy?: boolean;
}

function applyMediaAspectRatio(
  width: number,
  height: number,
  setAspectRatio: (ratio: number) => void
) {
  if (width > 0 && height > 0) {
    setAspectRatio(width / height);
  }
}

function readPrimaryStudioMedia(
  data: WorkflowNodeType,
  isVideo: boolean
): MediaReference | undefined {
  if (isVideo) {
    return readAiVideoCardVideos(data.inputs, data.outputs, data.metadata)[0];
  }
  return readAiImageCardImages(data.inputs, data.outputs, data.metadata)[0];
}

export function hasStudioMediaContent(
  data: WorkflowNodeType,
  isVideo: boolean
): boolean {
  const media = readPrimaryStudioMedia(data, isVideo);
  return media != null && isMediaReference(media);
}

export interface CreativeStudioMediaPreviewPlaceholderProps {
  readonly isVideo: boolean;
  readonly message?: string;
  readonly busy?: boolean;
  readonly size?: "list" | "detail";
}

export function CreativeStudioMediaPreviewPlaceholder({
  isVideo,
  message,
  busy = false,
  size = "list",
}: CreativeStudioMediaPreviewPlaceholderProps) {
  const Icon = isVideo ? Video : Image;

  return (
    <CreativeStudioMediaPreviewSlot
      aspectRatio={DEFAULT_ASPECT_RATIO}
      className={STUDIO_MEDIA_PREVIEW_PLACEHOLDER}
    >
      {busy ? (
        <LoaderIcon
          className={cn(
            "shrink-0 animate-spin text-yellow-500",
            size === "detail" ? "h-6 w-6" : "h-5 w-5"
          )}
          aria-hidden
        />
      ) : (
        <Icon
          className={cn(
            "shrink-0 opacity-40",
            size === "detail" ? "h-8 w-8" : "h-6 w-6"
          )}
          aria-hidden
        />
      )}
      {message ? (
        <span
          className={cn(
            "max-w-full truncate px-2 text-center italic",
            size === "detail" ? "text-sm" : "text-[11px]"
          )}
        >
          {message}
        </span>
      ) : null}
    </CreativeStudioMediaPreviewSlot>
  );
}

export interface StudioMediaEmptyPreviewProps {
  readonly isVideo: boolean;
  readonly message?: string;
  readonly busy?: boolean;
  readonly layout?: "list" | "detail";
  readonly className?: string;
}

/** Shared empty media slot — list card or detail edit area. */
export function StudioMediaEmptyPreview({
  isVideo,
  message,
  busy = false,
  layout = "list",
  className,
}: StudioMediaEmptyPreviewProps) {
  const placeholder = (
    <CreativeStudioMediaPreviewPlaceholder
      isVideo={isVideo}
      message={message}
      busy={busy}
      size={layout === "detail" ? "detail" : "list"}
    />
  );

  if (layout === "detail") {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center p-4",
          className
        )}
      >
        <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border/50 bg-card dark:border-neutral-700 dark:bg-neutral-800">
          {placeholder}
        </div>
      </div>
    );
  }

  return <div className={className}>{placeholder}</div>;
}

export function CreativeStudioMediaPreviewFrame({
  media,
  displayUrl,
  stale,
  isVideo,
  referenceDragEnabled = false,
  fallbackMessage,
  fallbackBusy = false,
}: CreativeStudioMediaPreviewFrameProps) {
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);

  if (!media || stale || !displayUrl) {
    return (
      <CreativeStudioMediaPreviewPlaceholder
        isVideo={isVideo}
        message={fallbackMessage}
        busy={fallbackBusy}
      />
    );
  }

  return (
    <CreativeStudioMediaPreviewSlot aspectRatio={aspectRatio} videoSurface={isVideo}>
      {isVideo ? (
        <>
          <video
            src={displayUrl}
            className={STUDIO_MEDIA_PREVIEW_MEDIA}
            draggable={!referenceDragEnabled}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => {
              applyMediaAspectRatio(
                event.currentTarget.videoWidth,
                event.currentTarget.videoHeight,
                setAspectRatio
              );
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-sm">
              <Play className="h-4 w-4 text-foreground" />
            </div>
          </div>
        </>
      ) : (
        <img
          src={displayUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={!referenceDragEnabled}
          className="size-full select-none object-cover"
          onLoad={(event) => {
            applyMediaAspectRatio(
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight,
              setAspectRatio
            );
          }}
        />
      )}
    </CreativeStudioMediaPreviewSlot>
  );
}
