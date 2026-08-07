import {
  type MediaReference,
} from "@dafthunk/types";
import MusicIcon from "lucide-react/icons/music";
import PlayIcon from "lucide-react/icons/play";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useCanvasMediaCoverUrl } from "@/hooks/use-canvas-media-cover-url";
import { useMediaDisplayUrl } from "@/hooks/use-media-display-url";
import { cn } from "@/utils/utils";

import { WorkflowMediaVideoPlayer } from "./workflow-media-video-player";

const UNAVAILABLE_DEBOUNCE_MS = 300;

const decodedDisplayUrlCache = new Set<string>();

function useDecodedDisplayUrl(params: {
  readonly displayUrl: string | null;
  readonly onBroken: () => void;
}): {
  readonly imgSrc: string | null;
  readonly imageReady: boolean;
} {
  const { displayUrl, onBroken } = params;
  const [imageReady, setImageReady] = useState(() =>
    Boolean(displayUrl && decodedDisplayUrlCache.has(displayUrl))
  );

  useEffect(() => {
    if (!displayUrl) {
      setImageReady(false);
      return;
    }

    if (decodedDisplayUrlCache.has(displayUrl)) {
      setImageReady(true);
      return;
    }

    setImageReady(false);
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      decodedDisplayUrlCache.add(displayUrl);
      setImageReady(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      onBroken();
    };
    img.src = displayUrl;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [displayUrl, onBroken]);

  return { imgSrc: displayUrl, imageReady };
}

function useDebouncedUnavailable(
  unavailable: boolean,
  delayMs = UNAVAILABLE_DEBOUNCE_MS
): boolean {
  const [debounced, setDebounced] = useState(false);

  useEffect(() => {
    if (!unavailable) {
      setDebounced(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setDebounced(true);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [unavailable, delayMs]);

  return debounced;
}

export type CanvasMediaFitMode = "cover" | "contain";

interface CanvasMediaCoverBaseProps {
  readonly media: MediaReference;
  readonly cardWidthPx: number;
  readonly cardHeightPx: number;
  readonly fitMode?: CanvasMediaFitMode;
  readonly className?: string;
  readonly onNaturalSize?: (width: number, height: number) => void;
  /** When true, video shows s-tier poster only (no hover playback). */
  readonly staticCover?: boolean;
}

function CanvasImageCover({
  media,
  cardWidthPx,
  cardHeightPx,
  fitMode = "cover",
  className,
  onNaturalSize,
}: CanvasMediaCoverBaseProps) {
  const { t } = useTranslation();
  const { displayUrl, isCanvasOnScreen, retry } = useCanvasMediaCoverUrl({
    media,
    nodeType: "ai-image",
    cardWidthPx,
    cardHeightPx,
  });
  const handleBroken = useCallback(() => {
    if (displayUrl) {
      decodedDisplayUrlCache.delete(displayUrl);
    }
    retry();
  }, [displayUrl, retry]);
  const { imgSrc, imageReady } = useDecodedDisplayUrl({
    displayUrl,
    onBroken: handleBroken,
  });
  const showUnavailable = useDebouncedUnavailable(!imgSrc && isCanvasOnScreen);
  const fitClassName = fitMode === "contain" ? "object-contain" : "object-cover";

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {imgSrc ? (
        <img
          src={imgSrc}
          alt=""
          draggable={false}
          decoding="async"
          className={cn(
            "block h-full w-full transition-opacity duration-100",
            fitClassName,
            imageReady ? "opacity-100" : "opacity-0"
          )}
          onLoad={(event) => {
            const img = event.currentTarget;
            const loadedSrc = img.currentSrc || img.src;
            if (loadedSrc) {
              decodedDisplayUrlCache.add(loadedSrc);
            }
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              onNaturalSize?.(img.naturalWidth, img.naturalHeight);
            }
          }}
          onError={handleBroken}
        />
      ) : null}

      {showUnavailable ? (
        <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-neutral-400">
          {t("workflow.aiMediaCache.imageUnavailable")}
        </div>
      ) : null}
    </div>
  );
}

function CanvasVideoCover({
  media,
  cardWidthPx,
  cardHeightPx,
  fitMode = "cover",
  className,
  onNaturalSize,
  staticCover = false,
}: CanvasMediaCoverBaseProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const { displayUrl, isCanvasOnScreen, retry } = useCanvasMediaCoverUrl({
    media,
    nodeType: "ai-video",
    cardWidthPx,
    cardHeightPx,
  });
  const hoverPreviewEnabled =
    !staticCover && isHovered && isCanvasOnScreen;
  const { displayUrl: videoUrl } = useMediaDisplayUrl({
    media,
    nodeType: "ai-video",
    size: "full",
    localOnly: true,
    paused: !hoverPreviewEnabled,
  });

  useEffect(() => {
    if (staticCover || !isCanvasOnScreen) {
      setIsHovered(false);
    }
  }, [isCanvasOnScreen, staticCover]);

  const handleBroken = useCallback(() => {
    if (displayUrl) {
      decodedDisplayUrlCache.delete(displayUrl);
    }
    retry();
  }, [displayUrl, retry]);
  const { imgSrc, imageReady } = useDecodedDisplayUrl({
    displayUrl,
    onBroken: handleBroken,
  });

  const showVideoPlayer = hoverPreviewEnabled && Boolean(videoUrl);
  const showPlayIcon = !showVideoPlayer && Boolean(imgSrc) && imageReady;
  const showUnavailable = useDebouncedUnavailable(!imgSrc && isCanvasOnScreen);
  const fitClassName = fitMode === "contain" ? "object-contain" : "object-cover";
  const objectFit = fitMode === "contain" ? "contain" : "cover";

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      onMouseEnter={
        staticCover ? undefined : () => setIsHovered(true)
      }
      onMouseLeave={
        staticCover ? undefined : () => setIsHovered(false)
      }
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt=""
          draggable={false}
          decoding="async"
          className={cn(
            "block h-full w-full transition-opacity duration-100",
            fitClassName,
            showVideoPlayer
              ? "pointer-events-none absolute inset-0 opacity-0"
              : imageReady
                ? "opacity-100"
                : "opacity-0"
          )}
          onLoad={(event) => {
            const img = event.currentTarget;
            const loadedSrc = img.currentSrc || img.src;
            if (loadedSrc) {
              decodedDisplayUrlCache.add(loadedSrc);
            }
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              onNaturalSize?.(img.naturalWidth, img.naturalHeight);
            }
          }}
          onError={handleBroken}
        />
      ) : null}

      {showVideoPlayer && videoUrl ? (
        <WorkflowMediaVideoPlayer
          key={videoUrl}
          src={videoUrl}
          variant="card"
          objectFit={objectFit}
          initialHovered
          className="absolute inset-0 z-10"
        />
      ) : null}

      {showPlayIcon ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
          <PlayIcon
            className={cn(
              "text-white/85",
              staticCover ? "h-5 w-5" : "h-8 w-8"
            )}
            strokeWidth={1.75}
          />
        </div>
      ) : null}

      {showUnavailable ? (
        <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-neutral-400">
          {t("workflow.aiMediaCache.videoUnavailable")}
        </div>
      ) : null}
    </div>
  );
}

export interface CanvasMediaCoverProps extends CanvasMediaCoverBaseProps {
  readonly nodeType: "ai-image" | "ai-video";
}

export function CanvasMediaCover({
  media,
  nodeType,
  cardWidthPx,
  cardHeightPx,
  fitMode = "cover",
  className,
  onNaturalSize,
  staticCover = false,
}: CanvasMediaCoverProps) {
  if (nodeType === "ai-video") {
    return (
      <CanvasVideoCover
        media={media}
        cardWidthPx={cardWidthPx}
        cardHeightPx={cardHeightPx}
        fitMode={fitMode}
        className={className}
        onNaturalSize={onNaturalSize}
        staticCover={staticCover}
      />
    );
  }

  return (
    <CanvasImageCover
      media={media}
      cardWidthPx={cardWidthPx}
      cardHeightPx={cardHeightPx}
      fitMode={fitMode}
      className={className}
      onNaturalSize={onNaturalSize}
    />
  );
}

export function CanvasAudioCover({
  className,
}: {
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/30 text-muted-foreground",
        className
      )}
    >
      <MusicIcon className="h-8 w-8 opacity-70" strokeWidth={1.75} />
    </div>
  );
}

const HISTORY_LIST_THUMB_PX = 72;

function isElementVisible(element: HTMLElement, root: HTMLElement | null): boolean {
  const targetRect = element.getBoundingClientRect();
  if (targetRect.width <= 0 || targetRect.height <= 0) return false;

  if (!root) {
    return targetRect.top < window.innerHeight && targetRect.bottom > 0;
  }

  const rootRect = root.getBoundingClientRect();
  return (
    targetRect.bottom > rootRect.top &&
    targetRect.top < rootRect.bottom &&
    targetRect.right > rootRect.left &&
    targetRect.left < rootRect.right
  );
}

export interface LazyCanvasMediaCoverProps {
  readonly media: MediaReference;
  readonly nodeType: "ai-image" | "ai-video";
  readonly className?: string;
  readonly scrollRoot?: HTMLElement | null;
}

/** Defer mount until visible — URL logic stays in CanvasMediaCover. */
export function LazyCanvasMediaCover({
  media,
  nodeType,
  className,
  scrollRoot = null,
}: LazyCanvasMediaCoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    if (isElementVisible(element, scrollRoot)) {
      setVisible(true);
      return;
    }

    const root = scrollRoot ?? null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root, rootMargin: "80px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRoot]);

  return (
    <div ref={containerRef} className={className}>
      {visible ? (
        <CanvasMediaCover
          media={media}
          nodeType={nodeType}
          cardWidthPx={HISTORY_LIST_THUMB_PX}
          cardHeightPx={HISTORY_LIST_THUMB_PX}
          fitMode="cover"
          className="h-full w-full rounded-none border-0"
          staticCover
        />
      ) : (
        <div className="h-full w-full bg-muted/60" />
      )}
    </div>
  );
}
