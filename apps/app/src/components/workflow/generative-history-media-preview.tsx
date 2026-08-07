import { getMediaReferenceKey, type MediaReference } from "@dafthunk/types";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { isMediaExpired } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import { MediaImageField } from "./fields/media-image-field";
import { WorkflowMediaAudioPlayer } from "./workflow-media-audio-player";
import { WorkflowMediaVideoPlayer } from "./workflow-media-video-player";

export type GenerativeHistoryMediaKind = "image" | "video" | "audio";

function GenerativeHistoryPreviewLoading({
  className,
  minHeightClass,
}: {
  readonly className?: string;
  readonly minHeightClass: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center rounded-md bg-muted/40",
        minHeightClass,
        className
      )}
    >
      <span className="text-xs text-muted-foreground">…</span>
    </div>
  );
}

export function GenerativeHistoryImagePreview({
  value,
  createObjectUrl,
  className,
  imageClassName,
}: {
  readonly value: MediaReference;
  readonly createObjectUrl?: (ref: import("@dafthunk/types").ObjectReference) => string;
  readonly className?: string;
  readonly imageClassName?: string;
}) {
  const mediaKey = getMediaReferenceKey(value);

  return (
    <MediaImageField
      key={mediaKey}
      value={value}
      createObjectUrl={createObjectUrl}
      className={className}
      imageClassName={imageClassName}
    />
  );
}

export function GenerativeHistoryVideoPreview({
  value,
  className,
}: {
  readonly value: MediaReference;
  readonly className?: string;
}) {
  const { t } = useTranslation();
  const mediaKey = getMediaReferenceKey(value);
  const expired = isMediaExpired(value);
  const { displayUrl, stale } = useMediaDisplayUrl({
    media: expired ? null : value,
    nodeType: "ai-video",
  });
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    setMediaError(false);
  }, [mediaKey]);

  if (!expired && !stale && !displayUrl) {
    return (
      <GenerativeHistoryPreviewLoading
        className={className}
        minHeightClass="min-h-[200px]"
      />
    );
  }

  if (stale || !displayUrl || mediaError) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400",
          className
        )}
      >
        {t("workflow.aiMediaCache.videoUnavailable")}
      </div>
    );
  }

  return (
    <WorkflowMediaVideoPlayer
      key={mediaKey}
      src={displayUrl}
      className={cn("min-h-[200px] w-full", className)}
      objectFit="contain"
      variant="card"
      onError={() => setMediaError(true)}
    />
  );
}

export function GenerativeHistoryAudioPreview({
  value,
  className,
}: {
  readonly value: MediaReference;
  readonly className?: string;
}) {
  const { t } = useTranslation();
  const mediaKey = getMediaReferenceKey(value);
  const expired = isMediaExpired(value);
  const { displayUrl, stale } = useMediaDisplayUrl({
    media: expired ? null : value,
    nodeType: "ai-audio",
  });
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    setMediaError(false);
  }, [mediaKey]);

  if (!expired && !stale && !displayUrl) {
    return (
      <GenerativeHistoryPreviewLoading
        className={className}
        minHeightClass="min-h-[120px]"
      />
    );
  }

  if (stale || !displayUrl || mediaError) {
    return (
      <div
        className={cn(
          "flex min-h-[120px] w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400",
          className
        )}
      >
        {t("workflow.aiMediaCache.audioUnavailable")}
      </div>
    );
  }

  return (
    <WorkflowMediaAudioPlayer
      key={mediaKey}
      src={displayUrl}
      className={className}
      variant="card"
      onError={() => setMediaError(true)}
    />
  );
}

export function GenerativeHistoryMediaPreview({
  mediaKind,
  value,
  createObjectUrl,
  className,
  imageClassName,
}: {
  readonly mediaKind: GenerativeHistoryMediaKind;
  readonly value: MediaReference;
  readonly createObjectUrl?: (ref: import("@dafthunk/types").ObjectReference) => string;
  readonly className?: string;
  readonly imageClassName?: string;
}) {
  const mediaKey = getMediaReferenceKey(value);

  if (mediaKind === "video") {
    return (
      <GenerativeHistoryVideoPreview
        key={mediaKey}
        value={value}
        className={className}
      />
    );
  }
  if (mediaKind === "audio") {
    return (
      <GenerativeHistoryAudioPreview
        key={mediaKey}
        value={value}
        className={className}
      />
    );
  }
  return (
    <GenerativeHistoryImagePreview
      key={mediaKey}
      value={value}
      createObjectUrl={createObjectUrl}
      className={className}
      imageClassName={imageClassName}
    />
  );
}
