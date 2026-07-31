import {
  isMediaReference,
  type MediaReference,
} from "@dafthunk/types";
import Image from "lucide-react/icons/image";
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
}

export function CreativeStudioMediaPreviewPlaceholder({
  isVideo,
  message,
}: CreativeStudioMediaPreviewPlaceholderProps) {
  const Icon = isVideo ? Video : Image;

  return (
    <CreativeStudioMediaPreviewSlot
      aspectRatio={DEFAULT_ASPECT_RATIO}
      className={STUDIO_MEDIA_PREVIEW_PLACEHOLDER}
    >
      <Icon className="h-6 w-6 shrink-0 opacity-40" aria-hidden />
      {message ? (
        <span className="max-w-full truncate px-2 text-center text-[11px] italic">
          {message}
        </span>
      ) : null}
    </CreativeStudioMediaPreviewSlot>
  );
}

export function CreativeStudioMediaPreviewFrame({
  media,
  displayUrl,
  stale,
  isVideo,
}: CreativeStudioMediaPreviewFrameProps) {
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);

  if (!media || stale || !displayUrl) {
    return <CreativeStudioMediaPreviewPlaceholder isVideo={isVideo} />;
  }

  return (
    <CreativeStudioMediaPreviewSlot aspectRatio={aspectRatio} videoSurface={isVideo}>
      {isVideo ? (
        <>
          <video
            src={displayUrl}
            className={STUDIO_MEDIA_PREVIEW_MEDIA}
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
