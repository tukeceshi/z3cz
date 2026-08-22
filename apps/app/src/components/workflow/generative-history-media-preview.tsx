import {
  getResourceIdFromValue,
  isFailedResourceRef,
  isGeneratingResourceRef,
  isMediaReference,
  isWorkflowMediaValue,
  type MediaReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { isMediaExpired } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import {
  fitGenerativeHistoryPreviewPlaceholder,
  fitGenerativeHistoryPreviewSize,
} from "./fit-generative-history-preview-size";
import { WorkflowMediaVideoPlayer } from "./workflow-media-video-player";

const WorkflowMediaAudioPlayer = lazy(() =>
  import("./workflow-media-audio-player").then((module) => ({
    default: module.WorkflowMediaAudioPlayer,
  }))
);

export type GenerativeHistoryMediaKind = "image" | "video" | "audio";

const DEFAULT_ASPECT_RATIO = 16 / 9;

interface MediaIntrinsicSize {
  readonly width: number;
  readonly height: number;
}

function readMediaIntrinsicSize(width: number, height: number): MediaIntrinsicSize | null {
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function useGenerativeHistoryPreviewBounds() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = (width: number) => {
      setContainerWidth(Math.max(0, width));
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      updateWidth(entry.contentRect.width);
    });

    observer.observe(element);
    updateWidth(element.clientWidth);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { containerRef, containerWidth };
}

function GenerativeHistoryMediaFrame({
  naturalSize,
  videoSurface = false,
  className,
  children,
}: {
  readonly naturalSize: MediaIntrinsicSize | null;
  readonly videoSurface?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const { containerRef, containerWidth } = useGenerativeHistoryPreviewBounds();

  const displaySize = useMemo(() => {
    if (naturalSize) {
      return fitGenerativeHistoryPreviewSize(
        containerWidth,
        naturalSize.width,
        naturalSize.height
      );
    }
    return fitGenerativeHistoryPreviewPlaceholder(
      containerWidth,
      DEFAULT_ASPECT_RATIO
    );
  }, [containerWidth, naturalSize]);

  return (
    <div ref={containerRef} className={cn("flex w-full justify-center", className)}>
      {displaySize ? (
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700",
            videoSurface ? "bg-neutral-950 dark:bg-black" : undefined
          )}
          style={{
            width: displaySize.width,
            height: displaySize.height,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

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
  className,
}: {
  readonly value: MediaReference | WorkflowMediaValue;
  readonly createObjectUrl?: (ref: import("@dafthunk/types").ObjectReference) => string;
  readonly className?: string;
}) {
  const { t } = useTranslation();
  const generating = isGeneratingResourceRef(value);
  const failed = isFailedResourceRef(value);
  const mediaKey = getResourceIdFromValue(value) ?? "image";
  const expired = isMediaReference(value) ? isMediaExpired(value) : false;
  const { displayUrl, phase } = useMediaDisplayUrl({
    media:
      expired || generating || failed || !isWorkflowMediaValue(value)
        ? null
        : value,
    nodeType: "ai-image",
  });
  const [imgError, setImgError] = useState(false);
  const [naturalSize, setNaturalSize] = useState<MediaIntrinsicSize | null>(null);

  useEffect(() => {
    setImgError(false);
    setNaturalSize(null);
  }, [mediaKey]);

  if (generating || failed) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 text-center text-xs text-muted-foreground dark:border-neutral-700 dark:bg-neutral-900",
          className
        )}
      >
        {generating
          ? t("workflow.aiImagePanel.generating")
          : t("workflow.generativeErrors.generationFailed")}
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <GenerativeHistoryPreviewLoading
        className={className}
        minHeightClass="min-h-[200px]"
      />
    );
  }

  if (phase !== "ready" || !displayUrl || imgError) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400",
          className
        )}
      >
        {t("workflow.aiMediaCache.imageUnavailable")}
      </div>
    );
  }

  return (
    <GenerativeHistoryMediaFrame naturalSize={naturalSize} className={className}>
      <img
        src={displayUrl}
        alt=""
        decoding="async"
        className="size-full select-none object-cover"
        onLoad={(event) => {
          setNaturalSize(
            readMediaIntrinsicSize(
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight
            )
          );
        }}
        onError={() => setImgError(true)}
      />
    </GenerativeHistoryMediaFrame>
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
  const mediaKey = getResourceIdFromValue(value) ?? "video";
  const expired = isMediaExpired(value);
  const { displayUrl, phase } = useMediaDisplayUrl({
    media: expired ? null : value,
    nodeType: "ai-video",
  });
  const [mediaError, setMediaError] = useState(false);
  const [naturalSize, setNaturalSize] = useState<MediaIntrinsicSize | null>(null);

  useEffect(() => {
    setMediaError(false);
    setNaturalSize(null);
  }, [mediaKey]);

  const handleLoadedMetadata = useCallback((video: HTMLVideoElement) => {
    setNaturalSize(readMediaIntrinsicSize(video.videoWidth, video.videoHeight));
  }, []);

  if (phase === "loading") {
    return (
      <GenerativeHistoryPreviewLoading
        className={className}
        minHeightClass="min-h-[200px]"
      />
    );
  }

  if (phase !== "ready" || !displayUrl || mediaError) {
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
    <GenerativeHistoryMediaFrame
      naturalSize={naturalSize}
      videoSurface
      className={className}
    >
      <WorkflowMediaVideoPlayer
        key={mediaKey}
        src={displayUrl}
        className="size-full"
        objectFit="cover"
        variant="card"
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => setMediaError(true)}
      />
    </GenerativeHistoryMediaFrame>
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
  const mediaKey = getResourceIdFromValue(value) ?? "audio";
  const expired = isMediaExpired(value);
  const { displayUrl, phase } = useMediaDisplayUrl({
    media: expired ? null : value,
    nodeType: "ai-audio",
  });
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    setMediaError(false);
  }, [mediaKey]);

  if (phase === "loading") {
    return (
      <GenerativeHistoryPreviewLoading
        className={className}
        minHeightClass="min-h-[120px]"
      />
    );
  }

  if (phase !== "ready" || !displayUrl || mediaError) {
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
    <Suspense fallback={null}>
      <WorkflowMediaAudioPlayer
        key={mediaKey}
        src={displayUrl}
        className={className}
        variant="card"
        onError={() => setMediaError(true)}
      />
    </Suspense>
  );
}

export function GenerativeHistoryMediaPreview({
  mediaKind,
  value,
  createObjectUrl,
  className,
}: {
  readonly mediaKind: GenerativeHistoryMediaKind;
  readonly value: MediaReference | WorkflowMediaValue;
  readonly createObjectUrl?: (ref: import("@dafthunk/types").ObjectReference) => string;
  readonly className?: string;
}) {
  const mediaKey = getResourceIdFromValue(value) ?? "media";

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
    />
  );
}
