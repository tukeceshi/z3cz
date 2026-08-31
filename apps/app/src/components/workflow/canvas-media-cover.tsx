import {
  createDefaultVideoRetakeTrimRange,
  createDefaultVideoTrimRange,
  isAiVideoRetakePanel,
  readAiVideoRetakeDraftFromInputs,
  type AiVideoRetakeDraft,
  type MediaReference,
  getResourceIdFromValue,
} from "@dafthunk/types";
import MusicIcon from "lucide-react/icons/music";
import PlayIcon from "lucide-react/icons/play";
import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { useNodes } from "@xyflow/react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { useCanvasMediaCoverUrl } from "@/hooks/use-canvas-media-cover-url";
import type { SharedMediaDisplayUrlSet } from "@/hooks/use-media-display-url";
import { deleteCachedMediaEntry } from "@/services/ai-media-cache-service";
import { resolveMediaDisplay } from "@/services/media-display-readiness";
import { MediaDisplayLoadingPlaceholder } from "./media-display-loading-placeholder";
import { resetMediaIngestState } from "@/services/media-ingest-coordinator";
import { cn } from "@/utils/utils";

import { useWorkflowVideoFrameCapture } from "./use-workflow-video-frame-capture";
import { withAiVideoRetakeDraft } from "./ai-video-retake-node-utils";
import { useOptionalVideoTrimSession } from "./video-trim-session-context";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";
import { WorkflowMediaVideoPlayer } from "./workflow-media-video-player";

const UNAVAILABLE_DEBOUNCE_MS = 300;
const BROKEN_MEDIA_RETRY_BEFORE_PURGE = 2;

const decodedDisplayUrlCache = new Set<string>();

function prefetchDecodedDisplayUrls(
  urls: readonly (string | null | undefined)[]
): void {
  for (const url of urls) {
    if (!url || decodedDisplayUrlCache.has(url)) {
      continue;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      decodedDisplayUrlCache.add(url);
    };
    img.src = url;
  }
}

function useBrokenMediaRecovery(params: {
  readonly media: MediaReference;
  readonly displayUrl: string | null;
  readonly retry: () => void;
}): () => void {
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id ?? "";
  const brokenAttemptsRef = useRef(0);
  const { media, displayUrl, retry } = params;

  return useCallback(() => {
    if (displayUrl) {
      decodedDisplayUrlCache.delete(displayUrl);
    }

    brokenAttemptsRef.current += 1;
    const mediaId = getResourceIdFromValue(media);
    if (
      brokenAttemptsRef.current >= BROKEN_MEDIA_RETRY_BEFORE_PURGE &&
      mediaId &&
      orgId &&
      workflowId
    ) {
      brokenAttemptsRef.current = 0;
      void deleteCachedMediaEntry({
        organizationId: orgId,
        workflowId,
        mediaId,
      });
      resetMediaIngestState({
        organizationId: orgId,
        workflowId,
        mediaId,
      });
    }

    retry();
  }, [displayUrl, media, orgId, retry, workflowId]);
}

const CANVAS_TIER_CROSSFADE_MS = 200;

function decodeDisplayUrl(
  url: string,
  onReady: () => void,
  onError: () => void
): () => void {
  if (decodedDisplayUrlCache.has(url)) {
    onReady();
    return () => {};
  }

  let cancelled = false;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    if (cancelled) {
      return;
    }
    decodedDisplayUrlCache.add(url);
    onReady();
  };
  img.onerror = () => {
    if (!cancelled) {
      onError();
    }
  };
  img.src = url;

  return () => {
    cancelled = true;
    img.onload = null;
    img.onerror = null;
  };
}

function useDecodedDisplayUrl(params: {
  readonly displayUrl: string | null;
  readonly onBroken: () => void;
  /** Keep showing the last decoded frame while displayUrl is temporarily null. */
  readonly retainOnNull?: boolean;
}): {
  readonly baseSrc: string | null;
  readonly overlaySrc: string | null;
  readonly overlayVisible: boolean;
  readonly hasImage: boolean;
  readonly onOverlayTransitionEnd: () => void;
} {
  const { displayUrl, onBroken, retainOnNull = false } = params;
  const [baseSrc, setBaseSrc] = useState<string | null>(() => {
    if (displayUrl && decodedDisplayUrlCache.has(displayUrl)) {
      return displayUrl;
    }
    return null;
  });
  const [overlaySrc, setOverlaySrc] = useState<string | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const targetUrlRef = useRef<string | null>(displayUrl);
  const baseSrcRef = useRef(baseSrc);
  baseSrcRef.current = baseSrc;

  useEffect(() => {
    targetUrlRef.current = displayUrl;

    if (!displayUrl) {
      if (!retainOnNull) {
        setBaseSrc(null);
        setOverlaySrc(null);
        setOverlayVisible(false);
      }
      return;
    }

    const reveal = (url: string) => {
      if (targetUrlRef.current !== url) {
        return;
      }

      const currentBase = baseSrcRef.current;
      if (!currentBase) {
        setOverlaySrc(null);
        setOverlayVisible(false);
        setBaseSrc(url);
        return;
      }

      if (currentBase === url) {
        setOverlaySrc(null);
        setOverlayVisible(false);
        return;
      }

      setOverlaySrc(url);
      setOverlayVisible(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (targetUrlRef.current === url) {
            setOverlayVisible(true);
          }
        });
      });
    };

    return decodeDisplayUrl(displayUrl, () => reveal(displayUrl), onBroken);
  }, [displayUrl, onBroken, retainOnNull]);

  const onOverlayTransitionEnd = useCallback(() => {
    if (!overlayVisible) {
      return;
    }
    setOverlaySrc((currentOverlay) => {
      if (!currentOverlay) {
        return null;
      }
      setBaseSrc(currentOverlay);
      return null;
    });
    setOverlayVisible(false);
  }, [overlayVisible]);

  return {
    baseSrc,
    overlaySrc,
    overlayVisible,
    hasImage: baseSrc != null || overlaySrc != null,
    onOverlayTransitionEnd,
  };
}

function handleCoverImageLoad(
  event: SyntheticEvent<HTMLImageElement>,
  onNaturalSize?: (width: number, height: number) => void
): void {
  const img = event.currentTarget;
  const loadedSrc = img.currentSrc || img.src;
  if (loadedSrc) {
    decodedDisplayUrlCache.add(loadedSrc);
  }
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    onNaturalSize?.(img.naturalWidth, img.naturalHeight);
  }
}

function CanvasTierCoverImage({
  baseSrc,
  overlaySrc,
  overlayVisible,
  onOverlayTransitionEnd,
  fitClassName,
  onNaturalSize,
  onBroken,
  className,
}: {
  readonly baseSrc: string | null;
  readonly overlaySrc: string | null;
  readonly overlayVisible: boolean;
  readonly onOverlayTransitionEnd: () => void;
  readonly fitClassName: string;
  readonly onNaturalSize?: (width: number, height: number) => void;
  readonly onBroken: () => void;
  readonly className?: string;
}) {
  const imageClassName = cn(
    "absolute inset-0 block h-full w-full",
    fitClassName,
    className
  );

  return (
    <>
      {baseSrc ? (
        <img
          src={baseSrc}
          alt=""
          draggable={false}
          decoding="async"
          className={imageClassName}
          onLoad={(event) => handleCoverImageLoad(event, onNaturalSize)}
          onError={onBroken}
        />
      ) : null}
      {overlaySrc ? (
        <img
          src={overlaySrc}
          alt=""
          draggable={false}
          decoding="async"
          className={cn(
            imageClassName,
            "transition-opacity ease-out",
            overlayVisible ? "opacity-100" : "opacity-0"
          )}
          style={{ transitionDuration: `${CANVAS_TIER_CROSSFADE_MS}ms` }}
          onLoad={(event) => handleCoverImageLoad(event, onNaturalSize)}
          onTransitionEnd={(event) => {
            if (event.propertyName === "opacity") {
              onOverlayTransitionEnd();
            }
          }}
          onError={onBroken}
        />
      ) : null}
    </>
  );
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
  readonly onExpandView?: () => void;
  /** Canvas AI video node id — enables frame capture on hover preview. */
  readonly nodeId?: string;
  readonly sharedUrlSet?: SharedMediaDisplayUrlSet;
}

function CanvasMediaLoadingPlaceholder({
  className,
}: {
  readonly className?: string;
}) {
  return (
    <MediaDisplayLoadingPlaceholder className={cn("absolute inset-0", className)} />
  );
}

function CanvasImageCover({
  media,
  cardWidthPx,
  cardHeightPx,
  fitMode = "cover",
  className,
  onNaturalSize,
  sharedUrlSet,
}: CanvasMediaCoverBaseProps) {
  const { t } = useTranslation();
  const { displayUrl, phase, isCanvasOnScreen, urlSet, retry } = useCanvasMediaCoverUrl({
    media,
    nodeType: "ai-image",
    cardWidthPx,
    cardHeightPx,
    sharedUrlSet,
  });

  useEffect(() => {
    prefetchDecodedDisplayUrls([urlSet.s, urlSet.m, urlSet.l]);
  }, [urlSet.l, urlSet.m, urlSet.s]);

  const handleBroken = useBrokenMediaRecovery({ media, displayUrl, retry });
  const {
    baseSrc,
    overlaySrc,
    overlayVisible,
    hasImage,
    onOverlayTransitionEnd,
  } = useDecodedDisplayUrl({
    displayUrl: phase === "ready" ? displayUrl : null,
    retainOnNull: phase === "loading",
    onBroken: handleBroken,
  });
  const showUnavailable = useDebouncedUnavailable(
    phase === "missing" && isCanvasOnScreen
  );
  const fitClassName = fitMode === "contain" ? "object-contain" : "object-cover";

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {phase === "loading" && !hasImage ? <CanvasMediaLoadingPlaceholder /> : null}

      {hasImage ? (
        <CanvasTierCoverImage
          baseSrc={baseSrc}
          overlaySrc={overlaySrc}
          overlayVisible={overlayVisible}
          onOverlayTransitionEnd={onOverlayTransitionEnd}
          fitClassName={fitClassName}
          onNaturalSize={onNaturalSize}
          onBroken={handleBroken}
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
  onExpandView,
  nodeId,
  sharedUrlSet,
}: CanvasMediaCoverBaseProps) {
  const { t } = useTranslation();
  const frameCapture = useWorkflowVideoFrameCapture(nodeId);
  const nodes = useNodes();
  const { updateNodeData } = useWorkflow();
  const trimSessionApi = useOptionalVideoTrimSession();
  const trimActive = Boolean(nodeId && trimSessionApi?.isTrimActiveForNode(nodeId));
  const trimSession =
    trimActive && trimSessionApi?.session?.sourceNodeId === nodeId
      ? trimSessionApi.session
      : null;
  const flowNode = nodeId ? nodes.find((node) => node.id === nodeId) : undefined;
  const nodeSelected = flowNode?.selected === true;
  const nodeData = flowNode?.data as WorkflowNodeType | undefined;
  const isRetakePanel = isAiVideoRetakePanel(nodeData?.metadata);
  const retakeActive = Boolean(nodeId && isRetakePanel && nodeSelected);
  const retakeDraft = nodeData
    ? readAiVideoRetakeDraftFromInputs(nodeData.inputs)
    : null;
  const patchRetakeDraft = useCallback(
    (patch: Partial<AiVideoRetakeDraft>) => {
      if (!nodeId || !updateNodeData || !retakeActive) {
        return;
      }
      updateNodeData(nodeId, (current) => withAiVideoRetakeDraft(current, patch));
    },
    [nodeId, retakeActive, updateNodeData]
  );
  const setRetakePlaybackPaused = useCallback(
    (paused: boolean) => {
      patchRetakeDraft({ playbackPaused: paused });
    },
    [patchRetakeDraft]
  );
  const retakePlaybackSession =
    retakeActive && retakeDraft
      ? {
          committedRange: retakeDraft.committedRange,
          playbackPaused: retakeDraft.playbackPaused,
          loadPhase: retakeDraft.loadPhase,
        }
      : null;
  const [isHovered, setIsHovered] = useState(false);
  const ensureFullOnHover =
    trimActive || retakeActive || (!staticCover && isHovered);
  const {
    displayUrl,
    phase,
    isCanvasOnScreen,
    urlSet,
    stale,
    retry,
  } = useCanvasMediaCoverUrl({
    media,
    nodeType: "ai-video",
    cardWidthPx,
    cardHeightPx,
    sharedUrlSet,
    ensureSize: ensureFullOnHover ? "full" : undefined,
  });
  const hoverPreviewEnabled = ensureFullOnHover && isCanvasOnScreen;
  const fullVideoDisplay = useMemo(
    () =>
      resolveMediaDisplay({
        media: hoverPreviewEnabled ? media : null,
        urlSet,
        size: "full",
        stale,
      }),
    [hoverPreviewEnabled, media, stale, urlSet]
  );
  const hoverVideoUrl =
    fullVideoDisplay.phase === "ready" ? fullVideoDisplay.displayUrl : null;
  const playbackSession = retakeActive ? retakePlaybackSession : trimSession;
  const playbackActive = Boolean(playbackSession);
  const playbackVideoUrl = retakeActive
    ? hoverVideoUrl
    : (trimSession?.trimSourceVideoUrl ?? hoverVideoUrl);
  const showVideoPlayer =
    Boolean(playbackVideoUrl) &&
    (playbackActive || hoverPreviewEnabled);

  useEffect(() => {
    prefetchDecodedDisplayUrls([urlSet.s, urlSet.m, urlSet.l]);
  }, [urlSet.l, urlSet.m, urlSet.s]);

  useEffect(() => {
    if (staticCover || !isCanvasOnScreen) {
      setIsHovered(false);
    }
  }, [isCanvasOnScreen, staticCover]);

  const handleBroken = useBrokenMediaRecovery({ media, displayUrl, retry });
  const {
    baseSrc,
    overlaySrc,
    overlayVisible,
    hasImage,
    onOverlayTransitionEnd,
  } = useDecodedDisplayUrl({
    displayUrl: phase === "ready" ? displayUrl : null,
    retainOnNull: phase === "loading",
    onBroken: handleBroken,
  });

  const showHoverLoading =
    hoverPreviewEnabled && fullVideoDisplay.phase === "loading";
  const showPlayIcon =
    !showVideoPlayer && !showHoverLoading && hasImage && Boolean(baseSrc);
  const showUnavailable = useDebouncedUnavailable(
    phase === "missing" && isCanvasOnScreen
  );
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
      {phase === "loading" && !hasImage ? <CanvasMediaLoadingPlaceholder /> : null}

      {hasImage ? (
        <div
          className={cn(
            "absolute inset-0",
            showVideoPlayer && "pointer-events-none opacity-0"
          )}
        >
          <CanvasTierCoverImage
            baseSrc={baseSrc}
            overlaySrc={overlaySrc}
            overlayVisible={overlayVisible}
            onOverlayTransitionEnd={onOverlayTransitionEnd}
            fitClassName={fitClassName}
            onNaturalSize={onNaturalSize}
            onBroken={handleBroken}
          />
        </div>
      ) : null}

      {showVideoPlayer && playbackVideoUrl ? (
        <WorkflowMediaVideoPlayer
          key={playbackVideoUrl}
          src={playbackVideoUrl}
          variant="card"
          objectFit={objectFit}
          initialHovered
          externalPlaybackControl={playbackActive}
          playbackRange={
            playbackActive ? playbackSession?.committedRange ?? null : null
          }
          playbackPaused={
            playbackActive ? playbackSession?.playbackPaused ?? false : false
          }
          onPlaybackPausedChange={
            retakeActive
              ? setRetakePlaybackPaused
              : trimActive
                ? trimSessionApi?.setPlaybackPaused
                : undefined
          }
          className="absolute inset-0 z-10"
          showFrameCapture={frameCapture.showFrameCapture}
          frameCaptureDisabled={frameCapture.frameCaptureDisabled}
          videoRef={frameCapture.videoRef}
          onFrameCapture={frameCapture.onFrameCapture}
          onExpandView={onExpandView}
          onLoadedMetadata={(video) => {
            if (!playbackActive) {
              return;
            }
            const patchPlayback = retakeActive
              ? patchRetakeDraft
              : trimSessionApi?.patchTrimSession;
            if (!patchPlayback) {
              return;
            }
            if (!Number.isFinite(video.duration) || video.duration <= 0) {
              patchPlayback({ loadPhase: "error" });
              return;
            }
            const sourceVideoWidth =
              video.videoWidth > 0 ? video.videoWidth : null;
            const sourceVideoHeight =
              video.videoHeight > 0 ? video.videoHeight : null;
            if (playbackSession?.loadPhase === "loading") {
              if (retakeActive) {
                patchPlayback({
                  videoDurationSec: video.duration,
                  sourceVideoWidth,
                  sourceVideoHeight,
                  loadPhase: "ready",
                });
                return;
              }

              const defaultRange = createDefaultVideoTrimRange(video.duration);
              patchPlayback({
                trimSourceVideoUrl:
                  video.currentSrc || playbackVideoUrl || undefined,
                videoDurationSec: video.duration,
                loadPhase: "ready",
                committedRange: defaultRange,
                draftRange: defaultRange,
              });
              return;
            }
            patchPlayback({
              ...(retakeActive
                ? {}
                : {
                    trimSourceVideoUrl:
                      video.currentSrc || playbackVideoUrl || undefined,
                  }),
              videoDurationSec: video.duration,
              ...(retakeActive
                ? {
                    sourceVideoWidth,
                    sourceVideoHeight,
                  }
                : {}),
              loadPhase: "ready",
            });
          }}
          onError={() => {
            if (retakeActive) {
              patchRetakeDraft({ loadPhase: "error" });
            } else if (trimActive) {
              trimSessionApi?.patchTrimSession({ loadPhase: "error" });
            }
          }}
        />
      ) : null}

      {showHoverLoading ? (
        <div className="absolute inset-0 z-20">
          <CanvasMediaLoadingPlaceholder />
        </div>
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
  onExpandView,
  nodeId,
  sharedUrlSet,
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
        onExpandView={onExpandView}
        nodeId={nodeId}
        sharedUrlSet={sharedUrlSet}
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
      sharedUrlSet={sharedUrlSet}
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
