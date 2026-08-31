import type { VideoResolutionOption } from "./video-resolution-label";

/** Seedance 2.5 supported tiers only (no 4k). */
const SEEDANCE_25_RESOLUTION_PIXELS: Readonly<
  Record<VideoResolutionOption, readonly (readonly [number, number])[]>
> = {
  "480p": [
    [854, 480],
    [480, 854],
    [752, 560],
    [640, 640],
    [560, 752],
    [992, 432],
  ],
  "720p": [
    [1280, 720],
    [720, 1280],
    [1112, 834],
    [960, 960],
    [834, 1112],
    [1470, 630],
  ],
  "1080p": [
    [1920, 1080],
    [1080, 1920],
    [1664, 1248],
    [1440, 1440],
    [1248, 1664],
    [2206, 946],
  ],
  "768p": [],
  "2k": [],
  "4k": [],
};

function buildSeedance25PixelLookup(): ReadonlyMap<string, VideoResolutionOption> {
  const lookup = new Map<string, VideoResolutionOption>();
  for (const tier of ["480p", "720p", "1080p"] as const) {
    for (const [width, height] of SEEDANCE_25_RESOLUTION_PIXELS[tier]) {
      lookup.set(`${width}x${height}`, tier);
    }
  }
  return lookup;
}

const SEEDANCE_25_PIXEL_TO_RESOLUTION = buildSeedance25PixelLookup();

export function matchSeedance25ResolutionFromPixels(
  width: number,
  height: number
): VideoResolutionOption | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return SEEDANCE_25_PIXEL_TO_RESOLUTION.get(`${width}x${height}`) ?? null;
}

export const SEEDANCE_25_RESOLUTION_PIXEL_COUNT =
  SEEDANCE_25_PIXEL_TO_RESOLUTION.size;
