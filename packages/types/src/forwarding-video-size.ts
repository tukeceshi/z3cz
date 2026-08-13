export const FORWARDING_VIDEO_ASPECT_RATIOS = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
  "9:21",
] as const;

export type ForwardingVideoAspectRatio =
  (typeof FORWARDING_VIDEO_ASPECT_RATIOS)[number];

export const FORWARDING_LOCKED_RESOLUTIONS = [
  "480p",
  "720p",
  "1080p",
  "2K",
  "4K",
] as const;

export type ForwardingLockedResolution =
  (typeof FORWARDING_LOCKED_RESOLUTIONS)[number];

export type ForwardingVideoResolutionTier = ForwardingLockedResolution;

export const FORWARDING_VIDEO_SIZE_TABLE: Readonly<
  Record<
    ForwardingVideoResolutionTier,
    Readonly<Record<ForwardingVideoAspectRatio, string>>
  >
> = {
  "480p": {
    "16:9": "854x480",
    "9:16": "480x854",
    "1:1": "480x480",
    "4:3": "640x480",
    "3:4": "480x640",
    "21:9": "1120x480",
    "9:21": "480x1120",
  },
  "720p": {
    "16:9": "1280x720",
    "9:16": "720x1280",
    "1:1": "960x960",
    "4:3": "1112x834",
    "3:4": "834x1112",
    "21:9": "1470x630",
    "9:21": "630x1470",
  },
  "1080p": {
    "16:9": "1920x1080",
    "9:16": "1080x1920",
    "1:1": "1080x1080",
    "4:3": "1440x1080",
    "3:4": "1080x1440",
    "21:9": "2520x1080",
    "9:21": "1080x2520",
  },
  "2K": {
    "16:9": "2560x1440",
    "9:16": "1440x2560",
    "1:1": "1440x1440",
    "4:3": "1920x1440",
    "3:4": "1440x1920",
    "21:9": "3360x1440",
    "9:21": "1440x3360",
  },
  "4K": {
    "16:9": "3840x2160",
    "9:16": "2160x3840",
    "1:1": "2160x2160",
    "4:3": "2880x2160",
    "3:4": "2160x2880",
    "21:9": "5040x2160",
    "9:21": "2160x5040",
  },
};

function readTopLevelString(
  source: unknown,
  key: "ratio" | "resolution"
): string | undefined {
  if (typeof source !== "object" || source === null) {
    return undefined;
  }

  const value = (source as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeAspectRatio(value: string): ForwardingVideoAspectRatio | null {
  const normalized = value.trim().replace(/\s+/g, "");
  return FORWARDING_VIDEO_ASPECT_RATIOS.includes(
    normalized as ForwardingVideoAspectRatio
  )
    ? (normalized as ForwardingVideoAspectRatio)
    : null;
}

function normalizeResolutionTier(
  value: string
): ForwardingVideoResolutionTier | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "2k") {
    return "2K";
  }
  if (normalized === "4k") {
    return "4K";
  }
  if (
    normalized === "480p" ||
    normalized === "720p" ||
    normalized === "1080p"
  ) {
    return normalized;
  }
  return null;
}

export function resolveForwardingVideoSize(params: {
  readonly sourceBody: unknown;
  readonly lockedResolution?: ForwardingLockedResolution | null;
}): string | undefined {
  const ratio = readTopLevelString(params.sourceBody, "ratio");
  if (!ratio) {
    return undefined;
  }

  const aspectRatio = normalizeAspectRatio(ratio);
  if (!aspectRatio) {
    return undefined;
  }

  const requestResolution = readTopLevelString(params.sourceBody, "resolution");
  const resolutionTier =
    params.lockedResolution ??
    (requestResolution
      ? normalizeResolutionTier(requestResolution)
      : null);

  if (!resolutionTier) {
    return undefined;
  }

  return FORWARDING_VIDEO_SIZE_TABLE[resolutionTier][aspectRatio];
}
