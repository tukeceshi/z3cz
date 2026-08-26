export const VIDEO_RESOLUTION_OPTIONS = [
  "480p",
  "720p",
  "768p",
  "1080p",
  "2k",
  "4k",
] as const;

export type VideoResolutionOption = (typeof VIDEO_RESOLUTION_OPTIONS)[number];

export const VIDEO_PRICE_ESTIMATE_RESOLUTIONS = VIDEO_RESOLUTION_OPTIONS;

export type VideoPriceEstimateResolution = VideoResolutionOption;

const VIDEO_RESOLUTION_LABELS: Readonly<Record<VideoResolutionOption, string>> =
  {
    "480p": "480p",
    "720p": "720p",
    "768p": "768P",
    "1080p": "1080p",
    "2k": "2K",
    "4k": "4k",
  };

export function formatVideoResolutionLabel(resolution: string): string {
  const key = resolution.trim().toLowerCase();
  if (key in VIDEO_RESOLUTION_LABELS) {
    return VIDEO_RESOLUTION_LABELS[key as VideoResolutionOption];
  }
  return resolution;
}
