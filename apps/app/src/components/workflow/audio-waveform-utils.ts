export const LIBTV_WAVEFORM_BUCKET_COUNT = 512;

export interface LibTvAudioPeaks {
  readonly peaks: readonly (readonly number[])[];
  readonly duration: number;
}

const peakCache = new Map<string, LibTvAudioPeaks>();

const BAR_WIDTH_PX = 2;
const BAR_GAP_PX = 3;

async function decodeAudioArrayBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const audioContext = new AudioContext();
  try {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    void audioContext.close();
  }
}

function peaksFromAudioBuffer(audioBuffer: AudioBuffer): LibTvAudioPeaks {
  const channelCount = Math.min(audioBuffer.numberOfChannels, 2);
  const peaks: number[][] = [];

  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const channelData = audioBuffer.getChannelData(channelIndex);
    const step = Math.max(
      1,
      Math.floor(channelData.length / LIBTV_WAVEFORM_BUCKET_COUNT)
    );
    const channelPeaks: number[] = [];

    for (
      let bucketIndex = 0;
      bucketIndex < LIBTV_WAVEFORM_BUCKET_COUNT;
      bucketIndex += 1
    ) {
      const start = bucketIndex * step;
      const end = Math.min(start + step, channelData.length);
      let peak = 0;
      for (let index = start; index < end; index += 1) {
        const value = Math.abs(channelData[index] ?? 0);
        if (value > peak) {
          peak = value;
        }
      }
      channelPeaks.push(Math.round(peak * 10_000) / 10_000);
    }

    peaks.push(channelPeaks);
  }

  return {
    peaks,
    duration: audioBuffer.duration,
  };
}

export function getCachedLibTvPeaks(src: string): LibTvAudioPeaks | undefined {
  return peakCache.get(src);
}

export function cacheLibTvPeaks(src: string, data: LibTvAudioPeaks): void {
  peakCache.set(src, data);
}

async function loadAudioArrayBuffer(params: {
  readonly src: string;
  readonly blob?: Blob;
}): Promise<ArrayBuffer> {
  if (params.blob) {
    return params.blob.arrayBuffer();
  }

  const isHttpUrl =
    params.src.startsWith("http://") || params.src.startsWith("https://");

  if (isHttpUrl) {
    try {
      const authedResponse = await fetch(params.src, { credentials: "include" });
      if (authedResponse.ok) {
        return authedResponse.arrayBuffer();
      }
    } catch {
      // Fall through to unauthenticated fetch below.
    }
  }

  const response = await fetch(params.src);
  if (!response.ok) {
    throw new Error(`Failed to load audio (${response.status})`);
  }
  return response.arrayBuffer();
}

export function subsamplePeaksForWidth(
  peaks: readonly number[],
  containerWidthPx: number
): readonly number[] {
  if (peaks.length === 0 || containerWidthPx <= 0) {
    return [];
  }

  const targetCount = Math.max(
    1,
    Math.floor((containerWidthPx + BAR_GAP_PX) / (BAR_WIDTH_PX + BAR_GAP_PX))
  );

  if (peaks.length <= targetCount) {
    return peaks;
  }

  const sampled: number[] = [];
  for (let index = 0; index < targetCount; index += 1) {
    const start = Math.floor((index * peaks.length) / targetCount);
    const end = Math.floor(((index + 1) * peaks.length) / targetCount);
    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, peaks[sampleIndex] ?? 0);
    }
    sampled.push(peak);
  }

  return sampled;
}

export async function extractLibTvPeaks(params: {
  readonly src: string;
  readonly blob?: Blob;
  readonly cacheKey?: string;
}): Promise<LibTvAudioPeaks> {
  const cacheId = params.cacheKey ?? params.src;
  const cached = peakCache.get(cacheId);
  if (cached) {
    return cached;
  }

  const arrayBuffer = await loadAudioArrayBuffer(params);
  const audioBuffer = await decodeAudioArrayBuffer(arrayBuffer);
  const result = peaksFromAudioBuffer(audioBuffer);
  peakCache.set(cacheId, result);
  return result;
}

/** WaveSurfer expects Float32Array[] for multi-channel peaks. */
export function toWaveSurferPeaks(
  peaks: readonly (readonly number[])[]
): Float32Array[] {
  return peaks.map((channel) => Float32Array.from(channel));
}

export function getLibTvPeaksKey(
  peaks: readonly (readonly number[])[],
  duration: number
): string {
  if (peaks.length === 0 || duration <= 0) {
    return "";
  }

  const first = peaks[0] ?? [];
  const second = peaks[1] ?? [];
  return `${duration}:${first.length}:${second.length}:${first[0] ?? 0}:${first[first.length - 1] ?? 0}`;
}

export const LIBTV_WAVESURFER_LAYOUT = {
  cursorColor: "transparent",
  cursorWidth: 0,
  barWidth: 2,
  barGap: 3,
  barRadius: 2,
  height: 64,
  barHeight: 0.8,
  normalize: true,
  interact: false,
  fillParent: true,
} as const;

export interface LibTvWaveformColors {
  readonly waveColor: string;
  readonly progressColor: string;
}

export function getLibTvWaveformColors(isDark: boolean): LibTvWaveformColors {
  if (isDark) {
    return {
      waveColor: "#b3b3b3",
      progressColor: "#363636",
    };
  }

  return {
    waveColor: "#737373",
    progressColor: "#e5e5e5",
  };
}

export function buildLibTvWaveSurferOptions(isDark: boolean) {
  return {
    ...LIBTV_WAVESURFER_LAYOUT,
    ...getLibTvWaveformColors(isDark),
  };
}

/** @deprecated Use buildLibTvWaveSurferOptions(isDark) for theme-aware colors. */
export const LIBTV_WAVESURFER_OPTIONS = buildLibTvWaveSurferOptions(true);

export function getWaveSurferFetchParams(url: string): RequestInit | undefined {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { credentials: "include" };
  }
  return undefined;
}
