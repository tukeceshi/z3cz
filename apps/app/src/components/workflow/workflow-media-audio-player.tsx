import PauseIcon from "lucide-react/icons/pause";
import PlayIcon from "lucide-react/icons/play";
import DownloadIcon from "lucide-react/icons/download";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import { formatVideoTime } from "./capture-video-frame";
import { LibTvAudioProgressLine, LibTvAudioWaveform } from "./libtv-audio-waveform";
import { useAudioWaveform } from "./use-audio-waveform";

export interface WorkflowMediaAudioPlayerProps {
  readonly src: string;
  readonly className?: string;
  readonly variant?: "card" | "field";
  readonly downloadFileName?: string;
  readonly waveformBlob?: Blob;
  readonly waveformCacheKey?: string;
  readonly onError?: () => void;
}

function stopPointerPropagation(event: ReactPointerEvent) {
  event.stopPropagation();
}

const MAX_WAVEFORM_RETRIES = 8;
const WAVEFORM_RETRY_INTERVAL_MS = 400;

function LibTvPlayButton({
  isPlaying,
  onToggle,
  size = "card",
}: {
  readonly isPlaying: boolean;
  readonly onToggle: () => void;
  readonly size?: "card" | "field";
}) {
  const { t } = useTranslation();
  const dimension = size === "card" ? "h-7 w-7" : "h-8 w-8";
  const iconSize = "h-4 w-4";

  return (
    <button
      type="button"
      className={cn(
        "nodrag nopan nowheel flex shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:shadow-sm",
        dimension
      )}
      aria-label={
        isPlaying
          ? t("workflow.aiAudioPanel.pause")
          : t("workflow.aiAudioPanel.play")
      }
      onPointerDown={stopPointerPropagation}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {isPlaying ? (
        <PauseIcon className={cn(iconSize, "shrink-0")} strokeWidth={2} />
      ) : (
        <PlayIcon className={cn(iconSize, "shrink-0")} strokeWidth={2} />
      )}
    </button>
  );
}

export function WorkflowMediaAudioPlayer({
  src,
  className,
  variant = "card",
  downloadFileName = "audio.mp3",
  waveformBlob,
  waveformCacheKey,
  onError,
}: WorkflowMediaAudioPlayerProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const isCardVariant = variant === "card";

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [waveformRetryToken, setWaveformRetryToken] = useState(0);
  const waveformRetryCountRef = useRef(0);
  const isWaveformReadyRef = useRef(false);
  const isWaveformLoadingRef = useRef(true);

  const {
    peaks,
    duration: peakDuration,
    isLoading: isWaveformLoading,
    isReady: isWaveformReady,
  } = useAudioWaveform({
    src,
    blob: waveformBlob,
    cacheKey: waveformCacheKey,
    retryToken: waveformRetryToken,
  });

  isWaveformReadyRef.current = isWaveformReady;
  isWaveformLoadingRef.current = isWaveformLoading;

  const requestWaveformRetry = useCallback(() => {
    if (isWaveformReadyRef.current || isWaveformLoadingRef.current) {
      return;
    }
    if (waveformRetryCountRef.current >= MAX_WAVEFORM_RETRIES) {
      return;
    }
    waveformRetryCountRef.current += 1;
    setWaveformRetryToken((value) => value + 1);
  }, []);

  const progressRatio =
    duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsPlaying(!audio.paused);
    setCurrentTime(audio.currentTime);
    if (Number.isFinite(audio.duration)) {
      setDuration(audio.duration);
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleTimeUpdate = () => {
      if (audio.paused) {
        setCurrentTime(audio.currentTime);
      }
    };
    const handleSeeked = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("seeked", handleSeeked);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [src]);

  useEffect(() => {
    waveformRetryCountRef.current = 0;
    setWaveformRetryToken(0);
  }, [src, waveformBlob, waveformCacheKey]);

  useEffect(() => {
    if (isWaveformReady) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      if (isWaveformReadyRef.current || isWaveformLoadingRef.current) {
        return;
      }
      if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
        return;
      }
      requestWaveformRetry();
    }, WAVEFORM_RETRY_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isWaveformReady, requestWaveformRetry, src, waveformBlob]);

  useEffect(() => {
    if (peakDuration > 0 && duration <= 0) {
      setDuration(peakDuration);
    }
  }, [duration, peakDuration]);

  useEffect(() => {
    if (!isPlaying) return;

    let frameId = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        setCurrentTime(audio.currentTime);
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const handleTogglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      return;
    }
    audio.pause();
  }, []);

  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(src, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = downloadFileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(src, "_blank", "noopener,noreferrer");
    } finally {
      setIsDownloading(false);
    }
  }, [downloadFileName, isDownloading, src]);

  const timeLabel = `${formatVideoTime(currentTime)} / ${formatVideoTime(duration)}`;

  const waveformWindow = (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-muted dark:bg-neutral-700",
        isCardVariant ? "py-5" : "py-6"
      )}
    >
      <div className="pointer-events-none absolute inset-x-2 top-1/2 border-t border-dashed border-border dark:border-white/15" />
      <LibTvAudioWaveform
        src={src}
        waveformBlob={waveformBlob}
        peaks={peaks}
        duration={peakDuration}
        isLoading={isWaveformLoading && !isCardVariant}
        className="min-h-16"
        renderMode={isCardVariant ? "card" : "wavesurfer"}
      />
      <LibTvAudioProgressLine progressRatio={progressRatio} />
    </div>
  );

  if (isCardVariant) {
    return (
      <div className={cn("flex h-full w-full flex-col p-2", className)}>
        <audio ref={audioRef} src={src} preload="metadata" onError={onError} />
        {waveformWindow}
        <div className="mt-2 grid grid-cols-3 items-center">
          <div className="justify-self-start text-sm tabular-nums text-muted-foreground">
            {timeLabel}
          </div>
          <div className="justify-self-center">
            <LibTvPlayButton isPlaying={isPlaying} onToggle={handleTogglePlay} />
          </div>
          <div
            className="justify-self-end text-sm tabular-nums text-muted-foreground opacity-0"
            aria-hidden="true"
          >
            {timeLabel}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-md border border-border bg-card p-3 dark:border-neutral-700 dark:bg-neutral-900",
        className
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" onError={onError} />

      <button
        type="button"
        disabled={isDownloading}
        className={cn(
          "nodrag nopan nowheel absolute right-2 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white",
          isDownloading && "opacity-50"
        )}
        aria-label={t("workflow.aiAudioPanel.download")}
        onPointerDown={stopPointerPropagation}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          void handleDownload();
        }}
      >
        <DownloadIcon className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {waveformWindow}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm tabular-nums text-muted-foreground">{timeLabel}</span>
        <LibTvPlayButton
          isPlaying={isPlaying}
          onToggle={handleTogglePlay}
          size="field"
        />
      </div>
    </div>
  );
}
