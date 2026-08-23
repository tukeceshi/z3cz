export type SeedanceSeries = "2.0" | "2.5";

export interface SeedanceOutputPixels {
  readonly width: number;
  readonly height: number;
}

const STANDARD_16_9: Readonly<Record<string, readonly [number, number]>> = {
  "720p": [1280, 720],
  "1080p": [1920, 1080],
  "4k": [3840, 2160],
};

const RATIO_OVERRIDES: Readonly<
  Record<string, Readonly<Record<string, readonly [number, number]>>>
> = {
  "480p": {
    "4:3": [752, 560],
    "1:1": [640, 640],
    "3:4": [560, 752],
    "21:9": [992, 432],
  },
  "720p": {
    "4:3": [1112, 834],
    "1:1": [960, 960],
    "3:4": [834, 1112],
    "21:9": [1470, 630],
  },
  "1080p": {
    "4:3": [1664, 1248],
    "1:1": [1440, 1440],
    "3:4": [1248, 1664],
    "21:9": [2206, 946],
  },
  "4k": {
    "4:3": [3326, 2494],
    "1:1": [2880, 2880],
    "3:4": [2494, 3326],
    "21:9": [4398, 1886],
  },
};

function normalizeResolution(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeRatio(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

const ESTIMATE_RATIOS = new Set([
  "16:9",
  "9:16",
  "4:3",
  "1:1",
  "3:4",
  "21:9",
]);

function resolveSeedanceEstimateRatio(ratio: string): string {
  const aspect = normalizeRatio(ratio);
  if (!aspect || aspect === "adaptive" || !ESTIMATE_RATIOS.has(aspect)) {
    return "16:9";
  }
  return aspect;
}

export function resolveSeedanceSeries(canonicalId: string): SeedanceSeries {
  return canonicalId.includes("2-5") || canonicalId.includes("2.5")
    ? "2.5"
    : "2.0";
}

export function getSeedanceOutputPixels(
  series: SeedanceSeries,
  resolution: string,
  ratio: string
): SeedanceOutputPixels {
  const tier = normalizeResolution(resolution);
  const aspect = resolveSeedanceEstimateRatio(ratio);

  if (tier === "480p" && aspect === "16:9") {
    return series === "2.5"
      ? { width: 854, height: 480 }
      : { width: 864, height: 496 };
  }

  if (tier === "480p" && aspect === "9:16") {
    return series === "2.5"
      ? { width: 480, height: 854 }
      : { width: 496, height: 864 };
  }

  const override = RATIO_OVERRIDES[tier]?.[aspect];
  if (override) {
    return { width: override[0], height: override[1] };
  }

  const standard = STANDARD_16_9[tier];
  if (aspect === "16:9" && standard) {
    return { width: standard[0], height: standard[1] };
  }

  if (aspect === "9:16" && standard) {
    return { width: standard[1], height: standard[0] };
  }

  return { width: 1280, height: 720 };
}
