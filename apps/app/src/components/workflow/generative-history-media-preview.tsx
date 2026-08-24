import {
  getResourceIdFromValue,
  isFailedResourceRef,
  isGeneratingResourceRef,
  isMediaReference,
  isWorkflowMediaValue,
  type MediaReference,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { useTranslation } from "@/components/locale-provider";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { isMediaExpired } from "@/services/media-url-resolver";
import { cn } from "@/utils/utils";

import {
  fitGenerativeHistoryPreviewPlaceholder,
  fitGenerativeHistoryPreviewSize,
} from "./fit-generative-history-preview-size";
import {
  StudioImagePhotoProvider,
  StudioImageZoomHiddenTrigger,
  studioImagePreviewZoomClassName,
  useStudioImageZoomTrigger,
} from "./studio-image-lightbox";
import { StudioVideoLightbox } from "./studio-video-lightbox";
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
  zoomEnabled = false,
  onZoomClick,
  onZoomDoubleClick,
  children,
}: {
  readonly naturalSize: MediaIntrinsicSize | null;
  readonly videoSurface?: boolean;
  readonly className?: string;
  readonly zoomEnabled?: boolean;
  readonly onZoomClick?: (event: MouseEvent<HTMLDivElement>) => void;
  readonly onZoomDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
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
            videoSurface ? "bg-neutral-950 dark:bg-black" : undefined,
            studioImagePreviewZoomClassName(zoomEnabled)
          )}
          style={{
            width: displaySize.width,
            height: displaySize.height,
          }}
          onClick={zoomEnabled ? onZoomClick : undefined}
          onDoubleClick={zoomEnabled ? onZoomDoubleClick : undefined}
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
  onLightboxOpenChange,
}: {
  readonly value: MediaReference | WorkflowMediaValue;
  readonly createObjectUrl?: (ref: import("@dafthunk/types").ObjectReference) => string;
  readonly className?: string;
  readonly onLightboxOpenChange?: (open: boolean) => void;
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
  const {
    triggerRef,
    handlePreviewClick,
    handlePreviewDoubleClick,
  } = useStudioImageZoomTrigger();

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
    <StudioImagePhotoProvider onLightboxOpenChange={onLightboxOpenChange}>
      <StudioImageZoomHiddenTrigger src={displayUrl} triggerRef={triggerRef} />
      <GenerativeHistoryMediaFrame
        naturalSize={naturalSize}
        className={className}
        zoomEnabled
        onZoomClick={(event) => handlePreviewClick(event, true)}
        onZoomDoubleClick={handlePreviewDoubleClick}
      >
        <img
          src={displayUrl}
          alt=""
          decoding="async"
          className="pointer-events-none size-full select-none object-cover"
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
    </StudioImagePhotoProvider>
  );
}

export function GenerativeHistoryVideoPreview({
  value,
  className,
  onLightboxOpenChange,
}: {
  readonly value: MediaReference;
  readonly className?: string;
  readonly onLightboxOpenChange?: (open: boolean) => void;
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
  const [videoLightboxOpen, setVideoLightboxOpen] = useState(false);

  useEffect(() => {
    setMediaError(false);
    setNaturalSize(null);
    setVideoLightboxOpen(false);
  }, [mediaKey]);

  useEffect(() => {
    onLightboxOpenChange?.(false);
  }, [mediaKey, onLightboxOpenChange]);

  const handleLoadedMetadata = useCallback((video: HTMLVideoElement) => {
    setNaturalSize(readMediaIntrinsicSize(video.videoWidth, video.videoHeight));
  }, []);

  const handleOpenVideoLightbox = useCallback(() => {
    setVideoLightboxOpen(true);
    onLightboxOpenChange?.(true);
  }, [onLightboxOpenChange]);

  const handleCloseVideoLightbox = useCallback(() => {
    setVideoLightboxOpen(false);
    onLightboxOpenChange?.(false);
  }, [onLightboxOpenChange]);

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
    <>
      <GenerativeHistoryMediaFrame
        naturalSize={naturalSize}
        videoSurface
        className={className}
        zoomEnabled
        onZoomClick={(event) => {
          event.stopPropagation();
          handleOpenVideoLightbox();
        }}
      >
        <WorkflowMediaVideoPlayer
          key={mediaKey}
          src={displayUrl}
          className="size-full"
          objectFit="cover"
          variant="card"
          onLoadedMetadata={handleLoadedMetadata}
          onExpandView={handleOpenVideoLightbox}
          onError={() => setMediaError(true)}
        />
      </GenerativeHistoryMediaFrame>
      <StudioVideoLightbox
        open={videoLightboxOpen}
        src={displayUrl}
        onClose={handleCloseVideoLightbox}
      />
    </>
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
  onLightboxOpenChange,
}: {
  readonly mediaKind: GenerativeHistoryMediaKind;
  readonly value: MediaReference | WorkflowMediaValue;
  readonly createObjectUrl?: (ref: import("@dafthunk/types").ObjectReference) => string;
  readonly className?: string;
  readonly onLightboxOpenChange?: (open: boolean) => void;
}) {
  const mediaKey = getResourceIdFromValue(value) ?? "media";

  if (mediaKind === "video") {
    return (
      <GenerativeHistoryVideoPreview
        key={mediaKey}
        value={value}
        className={className}
        onLightboxOpenChange={onLightboxOpenChange}
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
      onLightboxOpenChange={onLightboxOpenChange}
    />
  );
}
