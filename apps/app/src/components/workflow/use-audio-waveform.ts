import { useEffect, useState } from "react";

import {
  extractLibTvPeaks,
  type LibTvAudioPeaks,
} from "./audio-waveform-utils";

interface UseAudioWaveformParams {
  readonly src: string;
  readonly blob?: Blob;
  readonly cacheKey?: string;
  /** Bump to re-run extraction after a prior failure (e.g. audio metadata ready). */
  readonly retryToken?: number;
}

const PEAK_EXTRACT_MAX_ATTEMPTS = 5;
const PEAK_EXTRACT_RETRY_BASE_MS = 250;
const BLOB_WAIT_MS = 800;

export function useAudioWaveform({
  src,
  blob,
  cacheKey,
  retryToken = 0,
}: UseAudioWaveformParams): {
  readonly peaks: readonly (readonly number[])[];
  readonly duration: number;
  readonly isLoading: boolean;
  readonly isReady: boolean;
} {
  const [data, setData] = useState<LibTvAudioPeaks | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!src.trim()) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setData(null);

    let cancelled = false;
    let retryTimeoutId = 0;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        retryTimeoutId = window.setTimeout(resolve, ms);
      });

    const run = async () => {
      if (cacheKey && !blob) {
        await sleep(BLOB_WAIT_MS);
        if (cancelled) {
          return;
        }
      }

      for (let attempt = 0; attempt < PEAK_EXTRACT_MAX_ATTEMPTS; attempt += 1) {
        if (cancelled) {
          return;
        }

        if (cacheKey && !blob) {
          await sleep(PEAK_EXTRACT_RETRY_BASE_MS * (attempt + 1));
          if (cancelled) {
            return;
          }
        }

        try {
          const result = await extractLibTvPeaks({
            src,
            blob,
            cacheKey,
          });
          if (cancelled) {
            return;
          }
          setData(result);
          setIsLoading(false);
          return;
        } catch {
          if (cancelled) {
            return;
          }
          if (attempt < PEAK_EXTRACT_MAX_ATTEMPTS - 1) {
            await sleep(PEAK_EXTRACT_RETRY_BASE_MS * (attempt + 1));
          }
        }
      }

      if (!cancelled) {
        setData(null);
        setIsLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimeoutId);
    };
  }, [blob, cacheKey, retryToken, src]);

  return {
    peaks: data?.peaks ?? EMPTY_PEAKS,
    duration: data?.duration ?? 0,
    isLoading,
    isReady: data !== null && data.peaks.length > 0 && data.duration > 0,
  };
}

const EMPTY_PEAKS: readonly (readonly number[])[] = [];
