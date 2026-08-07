import CameraIcon from "lucide-react/icons/camera";
import PauseIcon from "lucide-react/icons/pause";
import PlayIcon from "lucide-react/icons/play";
import Volume1Icon from "lucide-react/icons/volume-1";
import Volume2Icon from "lucide-react/icons/volume-2";
import VolumeXIcon from "lucide-react/icons/volume-x";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { useTranslation } from "@/components/locale-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/utils/utils";

import { videoSrcAllowsCrossOrigin } from "./video-src-cross-origin";
import {
  formatVideoTime,
  type VideoFrameCaptureMode,
} from "./capture-video-frame";

export interface WorkflowMediaVideoPlayerProps {
  readonly src: string;
  readonly className?: string;
  readonly videoClassName?: string;
  readonly objectFit?: "contain" | "cover";
  readonly variant?: "card" | "field";
  /** Card variant: start hovered with controls visible and autoplay (e.g. parent already has pointer inside). */
  readonly initialHovered?: boolean;
  readonly showFrameCapture?: boolean;
  readonly frameCaptureDisabled?: boolean;
  readonly onFrameCapture?: (mode: VideoFrameCaptureMode) => void;
  readonly onError?: () => void;
  readonly videoRef?: RefObject<HTMLVideoElement | null>;
}

function stopPointerPropagation(event: ReactPointerEvent) {
  event.stopPropagation();
}

export function WorkflowMediaVideoPlayer({
  src,
  className,
  videoClassName,
  objectFit = "contain",
  variant = "card",
  initialHovered = false,
  showFrameCapture = false,
  frameCaptureDisabled = false,
  onFrameCapture,
  onError,
  videoRef: externalVideoRef,
}: WorkflowMediaVideoPlayerProps) {
  const { t } = useTranslation();
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const lastVolumeBeforeMuteRef = useRef(1);
  const videoRef = externalVideoRef ?? internalVideoRef;

  const isCardVariant = variant === "card";
  const controlBarHeight = isCardVariant ? 70 : 56;
  const allowCrossOrigin = videoSrcAllowsCrossOrigin(src);
  const frameCaptureEnabled =
    showFrameCapture && allowCrossOrigin && !frameCaptureDisabled;

  const [isHovered, setIsHovered] = useState(
    () => variant === "card" && initialHovered
  );
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(isCardVariant);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);

  const showControls = !isCardVariant || isHovered;
  const showVolumeSlider =
    !isCardVariant || isVolumeHovered || isVolumeDragging;

  const syncTimeState = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (Number.isFinite(video.duration)) {
      setDuration(video.duration);
    }
  }, [videoRef]);

  const resetVideoToStart = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    if (video.currentTime !== 0) {
      video.currentTime = 0;
    }
    setCurrentTime(0);
    setIsPlaying(false);
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isCardVariant) {
      video.muted = true;
    }

    setIsPlaying(!video.paused);
    setIsMuted(video.muted);
    setVolume(video.volume);
    if (video.volume > 0) {
      lastVolumeBeforeMuteRef.current = video.volume;
    }
    syncTimeState();

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => syncTimeState();
    const handleTimeUpdate = () => {
      if (!isDragging) {
        syncTimeState();
      }
    };
    const handleVolumeChange = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
      if (video.volume > 0) {
        lastVolumeBeforeMuteRef.current = video.volume;
      }
    };
    const handleEnded = () => {
      if (isCardVariant) {
        resetVideoToStart();
      }
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("volumechange", handleVolumeChange);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("volumechange", handleVolumeChange);
      video.removeEventListener("ended", handleEnded);
    };
  }, [isCardVariant, isDragging, resetVideoToStart, src, syncTimeState, videoRef]);

  const tryCardAutoplay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    void video.play().catch(() => {
      video.muted = true;
      setIsMuted(true);
      void video.play().catch(() => {});
    });
  }, [videoRef]);

  const handleCardMouseEnter = useCallback(() => {
    if (!isCardVariant) return;
    setIsHovered(true);
    tryCardAutoplay();
  }, [isCardVariant, tryCardAutoplay]);

  useEffect(() => {
    if (!isCardVariant || !initialHovered) return;
    setIsHovered(true);
    tryCardAutoplay();
  }, [initialHovered, isCardVariant, src, tryCardAutoplay]);

  const handleCardMouseLeave = useCallback(() => {
    if (!isCardVariant) return;
    setIsHovered(false);
    setIsVolumeHovered(false);
    resetVideoToStart();
  }, [isCardVariant, resetVideoToStart]);

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play();
      return;
    }
    video.pause();
  }, [videoRef]);

  const applyVolume = useCallback(
    (nextVolume: number) => {
      const video = videoRef.current;
      if (!video) return;

      const clamped = Math.min(1, Math.max(0, nextVolume));
      video.volume = clamped;
      video.muted = clamped === 0;
      setVolume(clamped);
      setIsMuted(video.muted);
      if (clamped > 0) {
        lastVolumeBeforeMuteRef.current = clamped;
      }
    },
    [videoRef]
  );

  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted || video.volume === 0) {
      applyVolume(lastVolumeBeforeMuteRef.current || 1);
      video.muted = false;
      setIsMuted(false);
      return;
    }

    lastVolumeBeforeMuteRef.current = video.volume;
    video.muted = true;
    setIsMuted(true);
  }, [applyVolume, videoRef]);

  const setVolumeFromClientY = useCallback(
    (clientY: number) => {
      const track = volumeTrackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, 1 - (clientY - rect.top) / Math.max(rect.height, 1))
      );
      applyVolume(ratio);
      if (ratio > 0) {
        const video = videoRef.current;
        if (video) {
          video.muted = false;
          setIsMuted(false);
        }
      }
    },
    [applyVolume, videoRef]
  );

  const setVolumeFromClientX = useCallback(
    (clientX: number) => {
      const track = volumeTrackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / Math.max(rect.width, 1))
      );
      applyVolume(ratio);
    },
    [applyVolume]
  );

  const handleVerticalVolumePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      stopPointerPropagation(event);
      setIsVolumeDragging(true);
      setVolumeFromClientY(event.clientY);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setVolumeFromClientY(moveEvent.clientY);
      };
      const handlePointerUp = () => {
        setIsVolumeDragging(false);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [setVolumeFromClientY]
  );

  const handleHorizontalVolumePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      stopPointerPropagation(event);
      setVolumeFromClientX(event.clientX);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setVolumeFromClientX(moveEvent.clientX);
      };
      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [setVolumeFromClientX]
  );

  const seekToClientX = useCallback(
    (clientX: number) => {
      const video = videoRef.current;
      const track = progressTrackRef.current;
      if (!video || !track || !Number.isFinite(video.duration) || video.duration <= 0) {
        return;
      }

      const rect = track.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / Math.max(rect.width, 1))
      );
      video.currentTime = ratio * video.duration;
      setCurrentTime(video.currentTime);
    },
    [videoRef]
  );

  const handleProgressPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      stopPointerPropagation(event);
      setIsDragging(true);
      seekToClientX(event.clientX);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        seekToClientX(moveEvent.clientX);
      };
      const handlePointerUp = () => {
        setIsDragging(false);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [seekToClientX]
  );

  const progressRatio =
    duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const effectiveVolume = isMuted ? 0 : volume;
  const volumePercent = Math.round(effectiveVolume * 100);
  const fieldVolumeSliderWidth = 72;

  const volumeIcon =
    isMuted || effectiveVolume === 0 ? (
      <VolumeXIcon className="h-3.5 w-3.5" strokeWidth={2} />
    ) : effectiveVolume < 0.5 ? (
      <Volume1Icon className="h-3.5 w-3.5" strokeWidth={2} />
    ) : (
      <Volume2Icon className="h-3.5 w-3.5" strokeWidth={2} />
    );

  const handleFrameCapture = useCallback(
    (mode: VideoFrameCaptureMode) => {
      onFrameCapture?.(mode);
    },
    [onFrameCapture]
  );

  const volumeControl = isCardVariant ? (
    <div
      className="relative shrink-0"
      onMouseEnter={() => setIsVolumeHovered(true)}
      onMouseLeave={() => {
        if (!isVolumeDragging) {
          setIsVolumeHovered(false);
        }
      }}
    >
      <div
        className={cn(
          "absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col items-center transition-all duration-200",
          showVolumeSlider
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <div className="flex flex-col items-center rounded-lg bg-black/75 px-1.5 py-1.5">
          <span className="mb-1 text-[10px] tabular-nums text-white">
            {volumePercent}
          </span>
          <div
            ref={volumeTrackRef}
            className="relative flex h-20 w-4 cursor-pointer items-center justify-center"
            onPointerDown={handleVerticalVolumePointerDown}
          >
            <div className="absolute h-full w-0.5 rounded-full bg-white/30" />
            <div
              className="absolute bottom-0 w-0.5 rounded-full bg-white"
              style={{ height: `${effectiveVolume * 100}%` }}
            />
            <div
              className="absolute h-2 w-2 rounded-full bg-white"
              style={{ bottom: `calc(${effectiveVolume * 100}% - 4px)` }}
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-black/50"
        aria-label={
          isMuted
            ? t("workflow.aiVideoPanel.unmute")
            : t("workflow.aiVideoPanel.mute")
        }
        onClick={(event) => {
          event.stopPropagation();
          handleToggleMute();
        }}
      >
        {volumeIcon}
      </button>
    </div>
  ) : (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-black/50"
        aria-label={
          isMuted
            ? t("workflow.aiVideoPanel.unmute")
            : t("workflow.aiVideoPanel.mute")
        }
        onClick={(event) => {
          event.stopPropagation();
          handleToggleMute();
        }}
      >
        {volumeIcon}
      </button>
      <div
        ref={volumeTrackRef}
        className="relative flex h-3.5 cursor-pointer items-center"
        style={{ width: fieldVolumeSliderWidth }}
        onPointerDown={handleHorizontalVolumePointerDown}
      >
        <div className="h-0.5 w-full rounded-full bg-white/30" />
        <div
          className="absolute left-0 h-0.5 rounded-full bg-white"
          style={{ width: `${effectiveVolume * 100}%` }}
        />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white"
          style={{ left: `calc(${effectiveVolume * 100}% - 4px)` }}
        />
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "group/media relative h-full w-full overflow-hidden bg-neutral-950",
        className
      )}
      onMouseEnter={handleCardMouseEnter}
      onMouseLeave={handleCardMouseLeave}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        crossOrigin={allowCrossOrigin ? "anonymous" : undefined}
        disablePictureInPicture
        disableRemotePlayback
        muted={isCardVariant ? isMuted : undefined}
        className={cn(
          "h-full w-full",
          isCardVariant && "pointer-events-none",
          objectFit === "contain" ? "object-contain" : "object-cover",
          videoClassName
        )}
        onError={onError}
        onClick={
          isCardVariant
            ? undefined
            : (event) => {
                event.stopPropagation();
                handleTogglePlay();
              }
        }
      />

      <div
        className={cn(
          "nodrag nopan nowheel pointer-events-none absolute inset-x-0 bottom-0 transition-opacity duration-150",
          showControls ? "opacity-100" : "opacity-0"
        )}
        style={{ height: controlBarHeight }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))",
          }}
        />
      </div>

      <div
        className={cn(
          "nodrag nopan nowheel absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 pb-2.5 pt-8 transition-opacity duration-150",
          showControls
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        style={{ height: controlBarHeight }}
        onPointerDown={stopPointerPropagation}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-black/50"
          aria-label={
            isPlaying
              ? t("workflow.aiVideoPanel.pause")
              : t("workflow.aiVideoPanel.play")
          }
          onClick={(event) => {
            event.stopPropagation();
            handleTogglePlay();
          }}
        >
          {isPlaying ? (
            <PauseIcon className="h-4 w-4" strokeWidth={2} />
          ) : (
            <PlayIcon className="h-4 w-4 pl-0.5" strokeWidth={2} />
          )}
        </button>

        <span className="shrink-0 text-xs tabular-nums text-white">
          {formatVideoTime(currentTime)}
        </span>

        <div
          ref={progressTrackRef}
          className="relative flex h-3.5 min-w-0 flex-1 cursor-pointer items-center"
          onPointerDown={handleProgressPointerDown}
        >
          <div className="h-0.5 w-full rounded-full bg-white/30" />
          <div
            className="absolute left-0 h-0.5 rounded-full bg-white"
            style={{ width: `${progressRatio * 100}%` }}
          />
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white"
            style={{ left: `calc(${progressRatio * 100}% - 5px)` }}
          />
        </div>

        <span className="shrink-0 text-xs tabular-nums text-white">
          {formatVideoTime(duration)}
        </span>

        {volumeControl}

        {frameCaptureEnabled ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={frameCaptureDisabled}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-black/50",
                  frameCaptureDisabled && "pointer-events-none opacity-50"
                )}
                aria-label={t("workflow.aiVideoPanel.captureFrame")}
                onClick={(event) => event.stopPropagation()}
              >
                <CameraIcon className="h-4 w-4" strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => handleFrameCapture("first")}>
                {t("workflow.aiVideoPanel.captureFirstFrame")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFrameCapture("last")}>
                {t("workflow.aiVideoPanel.captureLastFrame")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFrameCapture("current")}>
                {t("workflow.aiVideoPanel.captureCurrentFrame")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
