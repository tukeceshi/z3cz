import type { VideoResolutionOption } from "./video-resolution-label";

const GENERATION_RESOLUTION_LONG_EDGE_PX: Readonly<
  Record<VideoResolutionOption, number>
> = {
  "480p": 854,
  "720p": 1280,
  "768p": 1366,
  "1080p": 1920,
  "2k": 2560,
  "4k": 3840,
};

const GENERATION_RESOLUTION_ORDER: readonly VideoResolutionOption[] = [
  "480p",
  "720p",
  "768p",
  "1080p",
  "2k",
  "4k",
];

function normalizeGenerationResolution(value: string): VideoResolutionOption | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "2k") {
    return "2k";
  }
  if (normalized === "4k") {
    return "4k";
  }
  if (
    normalized === "480p" ||
    normalized === "720p" ||
    normalized === "768p" ||
    normalized === "1080p"
  ) {
    return normalized;
  }
  return null;
}

function readGenerationResolutionRank(
  resolution: VideoResolutionOption
): number {
  return GENERATION_RESOLUTION_LONG_EDGE_PX[resolution];
}

export function inferVideoGenerationResolution(
  width: number,
  height: number
): VideoResolutionOption {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return "720p";
  }

  const longEdge = Math.max(width, height);
  if (longEdge <= GENERATION_RESOLUTION_LONG_EDGE_PX["480p"]) {
    return "480p";
  }
  if (longEdge <= GENERATION_RESOLUTION_LONG_EDGE_PX["720p"]) {
    return "720p";
  }
  if (longEdge <= GENERATION_RESOLUTION_LONG_EDGE_PX["768p"]) {
    return "768p";
  }
  if (longEdge <= GENERATION_RESOLUTION_LONG_EDGE_PX["1080p"]) {
    return "1080p";
  }
  if (longEdge <= GENERATION_RESOLUTION_LONG_EDGE_PX["2k"]) {
    return "2k";
  }
  return "4k";
}

export function pickAllowedVideoResolution(params: {
  readonly inferred: string;
  readonly allowedValues: readonly string[];
  readonly fallback: string;
}): string {
  const inferredTier = normalizeGenerationResolution(params.inferred);
  const fallbackTier =
    normalizeGenerationResolution(params.fallback) ?? ("720p" as const);
  const inferredRank = inferredTier
    ? readGenerationResolutionRank(inferredTier)
    : readGenerationResolutionRank(fallbackTier);

  const allowedTiers = params.allowedValues
    .map((value) => normalizeGenerationResolution(String(value)))
    .filter((value): value is VideoResolutionOption => value !== null);

  if (allowedTiers.length === 0) {
    return inferredTier ?? params.fallback;
  }

  const eligible = allowedTiers.filter(
    (tier) => readGenerationResolutionRank(tier) <= inferredRank
  );

  if (eligible.length === 0) {
    const fallbackAllowed = allowedTiers.find((tier) => tier === fallbackTier);
    if (fallbackAllowed) {
      return fallbackAllowed;
    }
    return allowedTiers[0] ?? params.fallback;
  }

  return eligible.reduce((best, tier) =>
    readGenerationResolutionRank(tier) > readGenerationResolutionRank(best)
      ? tier
      : best
  );
}

export function resolveDefaultVideoGenerationResolution(params: {
  readonly width: number | null | undefined;
  readonly height: number | null | undefined;
  readonly allowedValues: readonly string[];
  readonly fallback: string;
}): string {
  if (
    params.width == null ||
    params.height == null ||
    !Number.isFinite(params.width) ||
    !Number.isFinite(params.height) ||
    params.width <= 0 ||
    params.height <= 0
  ) {
    return params.fallback;
  }

  const inferred = inferVideoGenerationResolution(params.width, params.height);
  return pickAllowedVideoResolution({
    inferred,
    allowedValues: params.allowedValues,
    fallback: params.fallback,
  });
}

export const VIDEO_GENERATION_RESOLUTION_ORDER = GENERATION_RESOLUTION_ORDER;
