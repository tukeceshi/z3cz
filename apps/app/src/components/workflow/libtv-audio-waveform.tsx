import WaveSurfer from "wavesurfer.js";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/utils/utils";
import { useResolvedThemeMode } from "@/hooks/use-resolved-theme-mode";

import {
  buildLibTvWaveSurferOptions,
  getLibTvPeaksKey,
  getWaveSurferFetchParams,
  LIBTV_WAVESURFER_LAYOUT,
  subsamplePeaksForWidth,
  toWaveSurferPeaks,
} from "./audio-waveform-utils";

const MIN_WAVEFORM_CONTAINER_WIDTH_PX = 32;
const RESIZE_DEBOUNCE_MS = 100;
const MAX_LOAD_RETRIES = 3;
const LOAD_RETRY_DELAY_MS = 100;
const CONTAINER_WIDTH_WAIT_MS = 500;

export interface LibTvAudioWaveformProps {
  readonly src?: string;
  readonly waveformBlob?: Blob;
  readonly peaks: readonly (readonly number[])[];
  readonly duration: number;
  readonly isLoading: boolean;
  readonly className?: string;
  /** Card: WaveSurfer loads audio URL/blob directly (no pre-extracted peaks). */
  readonly renderMode?: "wavesurfer" | "dom" | "card";
}

export function LibTvAudioProgressLine({
  progressRatio,
}: {
  readonly progressRatio: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-y-[3.5px] left-2 right-2 z-[95]">
      <div
        className="absolute bottom-0 top-0 z-[100] flex w-4 -translate-x-1/2 justify-center will-change-[left]"
        style={{ left: `${progressRatio * 100}%` }}
      >
        <div className="h-full w-0.5 rounded-full bg-[#F54848] dark:bg-[#F54848]" />
      </div>
    </div>
  );
}

function mergePeaksForDisplay(
  peaks: readonly (readonly number[])[]
): readonly number[] {
  if (peaks.length === 0) {
    return [];
  }

  if (peaks.length === 1) {
    return peaks[0] ?? [];
  }

  const left = peaks[0] ?? [];
  const right = peaks[1] ?? [];
  const length = Math.min(left.length, right.length);
  const merged: number[] = [];

  for (let index = 0; index < length; index += 1) {
    merged.push(Math.max(left[index] ?? 0, right[index] ?? 0));
  }

  return merged;
}

function getWaveSurferCanvasWidth(container: HTMLElement): number {
  const host = container.firstElementChild as HTMLElement | null;
  const canvas = host?.shadowRoot?.querySelector("canvas");
  return canvas?.width ?? 0;
}

async function waitForContainerWidth(
  container: HTMLElement,
  maxWaitMs = CONTAINER_WIDTH_WAIT_MS
): Promise<boolean> {
  const started = performance.now();

  while (performance.now() - started < maxWaitMs) {
    if (container.clientWidth >= MIN_WAVEFORM_CONTAINER_WIDTH_PX) {
      return true;
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  return container.clientWidth >= MIN_WAVEFORM_CONTAINER_WIDTH_PX;
}

function LibTvDomWaveform({
  peaks,
  isLoading,
}: {
  readonly peaks: readonly number[];
  readonly isLoading: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const sampledPeaks = useMemo(
    () => subsamplePeaksForWidth(peaks, containerWidth),
    [containerWidth, peaks]
  );
  const maxPeak = Math.max(...sampledPeaks, 0.001);
  const maxBarHeightPx =
    LIBTV_WAVESURFER_LAYOUT.height * LIBTV_WAVESURFER_LAYOUT.barHeight * 0.5;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-16 w-full overflow-hidden">
      <div
        className={cn(
          "flex h-16 w-full shrink-0 items-center justify-center gap-[3px]",
          isLoading && "animate-pulse opacity-70"
        )}
      >
        {sampledPeaks.map((peak, index) => {
          const normalized = peak / maxPeak;
          const barHeightPx = Math.max(
            2,
            Math.round(normalized * maxBarHeightPx)
          );

          return (
            <div
              key={index}
              className="flex w-[2px] shrink-0 flex-col items-center justify-center"
              aria-hidden="true"
            >
              <div
                className="w-full rounded-[2px] bg-neutral-400 dark:bg-[#b3b3b3]"
                style={{ height: `${barHeightPx}px` }}
              />
              <div
                className="mt-0 w-full rounded-[2px] bg-neutral-400 dark:bg-[#b3b3b3]"
                style={{ height: `${barHeightPx}px` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LibTvCardAudioWaveform({
  src = "",
  waveformBlob,
  isLoading,
  className,
}: LibTvAudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const themeMode = useResolvedThemeMode();
  const isDark = themeMode === "dark";
  const waveSurferOptions = useMemo(
    () => buildLibTvWaveSurferOptions(isDark),
    [isDark]
  );

  useEffect(() => {
    setIsRendering(true);
  }, [src, waveformBlob, isDark]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const loadUrl = waveformBlob
      ? (() => {
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          blobUrlRef.current = URL.createObjectURL(waveformBlob);
          return blobUrlRef.current;
        })()
      : src.trim();

    if (!loadUrl) {
      setIsRendering(false);
      return;
    }

    let cancelled = false;
    let waveSurfer: WaveSurfer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeDebounceId = 0;
    let lastObservedWidth = 0;

    const reloadFromUrl = async (instance: WaveSurfer): Promise<boolean> => {
      for (let attempt = 0; attempt < MAX_LOAD_RETRIES; attempt += 1) {
        if (cancelled) {
          return false;
        }

        if (container.clientWidth < MIN_WAVEFORM_CONTAINER_WIDTH_PX) {
          const ready = await waitForContainerWidth(container);
          if (!ready || cancelled) {
            return false;
          }
        }

        await instance.load(loadUrl);

        if (cancelled) {
          return false;
        }

        if (
          getWaveSurferCanvasWidth(container) >= MIN_WAVEFORM_CONTAINER_WIDTH_PX
        ) {
          return true;
        }

        if (attempt < MAX_LOAD_RETRIES - 1) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, LOAD_RETRY_DELAY_MS);
          });
        }
      }

      return (
        getWaveSurferCanvasWidth(container) >= MIN_WAVEFORM_CONTAINER_WIDTH_PX
      );
    };

    const mountWaveSurfer = async () => {
      try {
        const ready = await waitForContainerWidth(container);
        if (!ready || cancelled) {
          return;
        }

        waveSurfer = WaveSurfer.create({
          container,
          ...waveSurferOptions,
          fetchParams: getWaveSurferFetchParams(loadUrl),
        });

        waveSurfer.on("ready", () => {
          if (!cancelled) {
            setIsRendering(false);
          }
        });

        waveSurfer.on("error", () => {
          if (!cancelled) {
            setIsRendering(false);
          }
        });

        const loaded = await reloadFromUrl(waveSurfer);
        if (cancelled) {
          return;
        }

        if (!loaded) {
          setIsRendering(false);
          return;
        }

        setIsRendering(false);
        lastObservedWidth = container.clientWidth;

        resizeObserver = new ResizeObserver(() => {
          if (cancelled || !waveSurfer) {
            return;
          }

          const nextWidth = container.clientWidth;
          if (nextWidth < MIN_WAVEFORM_CONTAINER_WIDTH_PX) {
            return;
          }
          if (nextWidth === lastObservedWidth) {
            return;
          }

          window.clearTimeout(resizeDebounceId);
          resizeDebounceId = window.setTimeout(() => {
            if (cancelled || !waveSurfer) {
              return;
            }

            lastObservedWidth = container.clientWidth;
            void reloadFromUrl(waveSurfer);
          }, RESIZE_DEBOUNCE_MS);
        });
        resizeObserver.observe(container);
      } catch {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    void mountWaveSurfer();

    return () => {
      cancelled = true;
      window.clearTimeout(resizeDebounceId);
      resizeObserver?.disconnect();
      waveSurfer?.destroy();
    };
  }, [isDark, src, waveSurferOptions, waveformBlob]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const showLoadingOverlay = isLoading || isRendering;

  return (
    <div className={cn("relative w-full px-2", className)}>
      <div
        ref={containerRef}
        className={cn("h-16 w-full", showLoadingOverlay && "opacity-60")}
      />
      {showLoadingOverlay ? (
        <div className="pointer-events-none absolute inset-0 animate-pulse rounded-md bg-foreground/5" />
      ) : null}
    </div>
  );
}

function LibTvDomAudioWaveform({
  peaks,
  duration,
  isLoading,
  className,
}: LibTvAudioWaveformProps) {
  const peaksKey = useMemo(
    () => getLibTvPeaksKey(peaks, duration),
    [duration, peaks]
  );
  const displayPeaks = useMemo(() => mergePeaksForDisplay(peaks), [peaks]);
  const hasDisplayPeaks = displayPeaks.length > 0 && peaksKey.length > 0;

  return (
    <div className={cn("relative w-full px-2", className)}>
      {hasDisplayPeaks ? (
        <LibTvDomWaveform peaks={displayPeaks} isLoading={isLoading} />
      ) : (
        <div className="h-16 w-full" />
      )}
      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 animate-pulse rounded-md bg-foreground/5" />
      ) : null}
    </div>
  );
}

function LibTvWaveSurferAudioWaveform({
  peaks,
  duration,
  isLoading,
  className,
}: LibTvAudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const peaksRef = useRef(peaks);
  const durationRef = useRef(duration);
  const [useDomFallback, setUseDomFallback] = useState(false);
  const themeMode = useResolvedThemeMode();
  const isDark = themeMode === "dark";
  const waveSurferOptions = useMemo(
    () => buildLibTvWaveSurferOptions(isDark),
    [isDark]
  );
  const peaksKey = useMemo(
    () => getLibTvPeaksKey(peaks, duration),
    [duration, peaks]
  );
  const displayPeaks = useMemo(() => mergePeaksForDisplay(peaks), [peaks]);

  peaksRef.current = peaks;
  durationRef.current = duration;

  useEffect(() => {
    setUseDomFallback(false);
  }, [isDark, peaksKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || peaksKey.length === 0 || duration <= 0) {
      return;
    }

    let cancelled = false;
    let waveSurfer: WaveSurfer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeDebounceId = 0;
    let lastObservedWidth = 0;

    const loadWaveform = async (instance: WaveSurfer): Promise<boolean> => {
      const wavePeaks = toWaveSurferPeaks(peaksRef.current);

      for (let attempt = 0; attempt < MAX_LOAD_RETRIES; attempt += 1) {
        if (cancelled) {
          return false;
        }

        if (container.clientWidth < MIN_WAVEFORM_CONTAINER_WIDTH_PX) {
          const ready = await waitForContainerWidth(container);
          if (!ready || cancelled) {
            return false;
          }
        }

        await instance.load("", wavePeaks, durationRef.current);

        if (cancelled) {
          return false;
        }

        if (
          getWaveSurferCanvasWidth(container) >= MIN_WAVEFORM_CONTAINER_WIDTH_PX
        ) {
          return true;
        }

        if (attempt < MAX_LOAD_RETRIES - 1) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, LOAD_RETRY_DELAY_MS);
          });
        }
      }

      return (
        getWaveSurferCanvasWidth(container) >= MIN_WAVEFORM_CONTAINER_WIDTH_PX
      );
    };

    const mountWaveSurfer = async () => {
      try {
        const ready = await waitForContainerWidth(container);
        if (!ready || cancelled) {
          return;
        }

        waveSurfer = WaveSurfer.create({
          container,
          ...waveSurferOptions,
        });

        waveSurfer.on("error", () => {
          if (!cancelled) {
            setUseDomFallback(true);
          }
        });

        const loaded = await loadWaveform(waveSurfer);
        if (cancelled) {
          return;
        }

        if (!loaded) {
          setUseDomFallback(true);
          return;
        }

        lastObservedWidth = container.clientWidth;

        resizeObserver = new ResizeObserver(() => {
          if (cancelled || !waveSurfer) {
            return;
          }

          const nextWidth = container.clientWidth;
          if (nextWidth < MIN_WAVEFORM_CONTAINER_WIDTH_PX) {
            return;
          }
          if (nextWidth === lastObservedWidth) {
            return;
          }

          window.clearTimeout(resizeDebounceId);
          resizeDebounceId = window.setTimeout(() => {
            if (cancelled || !waveSurfer?.getDecodedData()) {
              return;
            }

            lastObservedWidth = container.clientWidth;
            void loadWaveform(waveSurfer).then((success) => {
              if (!cancelled && !success) {
                setUseDomFallback(true);
              }
            });
          }, RESIZE_DEBOUNCE_MS);
        });
        resizeObserver.observe(container);
      } catch {
        if (!cancelled) {
          setUseDomFallback(true);
        }
      }
    };

    void mountWaveSurfer();

    return () => {
      cancelled = true;
      window.clearTimeout(resizeDebounceId);
      resizeObserver?.disconnect();
      waveSurfer?.destroy();
    };
  }, [duration, isDark, peaksKey, waveSurferOptions]);

  const showDomFallback =
    useDomFallback && displayPeaks.length > 0 && !isLoading;

  return (
    <div className={cn("relative w-full px-2", className)}>
      <div
        ref={containerRef}
        className={cn(
          "h-16 w-full",
          showDomFallback && "hidden",
          isLoading && !showDomFallback && "opacity-60"
        )}
      />

      {showDomFallback ? (
        <div className="absolute inset-x-2 top-0 h-16">
          <LibTvDomWaveform peaks={displayPeaks} isLoading={isLoading} />
        </div>
      ) : null}

      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 animate-pulse rounded-md bg-foreground/5" />
      ) : null}
    </div>
  );
}

export function LibTvAudioWaveform({
  renderMode = "wavesurfer",
  ...props
}: LibTvAudioWaveformProps) {
  if (renderMode === "card") {
    return <LibTvCardAudioWaveform {...props} />;
  }

  if (renderMode === "dom") {
    return <LibTvDomAudioWaveform {...props} />;
  }

  return <LibTvWaveSurferAudioWaveform {...props} />;
}
