import type { SeedanceSeries } from "./seedance-output-pixels";
import { resolveSeedanceSeries } from "./seedance-output-pixels";

export const LIBTV_PLAN_IDS = ["standard-monthly", "supreme-monthly"] as const;

export type LibtvPlanId = (typeof LIBTV_PLAN_IDS)[number];

export interface LibtvPlan {
  readonly id: LibtvPlanId;
  readonly credits: number;
  readonly priceYuan: number;
}

export interface LibtvResolutionRate {
  readonly withoutReferencePerSec: number;
  readonly withReferencePerSec: number | null;
}

export interface LibtvSeriesRates {
  readonly addReferenceSecondsToOutput: boolean;
  readonly resolutions: Readonly<Record<string, LibtvResolutionRate>>;
}

export interface LibtvComparisonConfig {
  readonly series: Readonly<Record<SeedanceSeries, LibtvSeriesRates>>;
  readonly plans: readonly LibtvPlan[];
}

export const LANDING_VOLCANO_MIN_RECHARGE_YUAN = 200 as const;

export const DEFAULT_LIBTV_COMPARISON_CONFIG: LibtvComparisonConfig = {
  series: {
    "2.0": {
      addReferenceSecondsToOutput: false,
      resolutions: {
        "480p": { withoutReferencePerSec: 13, withReferencePerSec: 20 },
        "720p": { withoutReferencePerSec: 27, withReferencePerSec: 49 },
        "1080p": { withoutReferencePerSec: 68, withReferencePerSec: 110 },
        "4k": { withoutReferencePerSec: 140, withReferencePerSec: 260 },
      },
    },
    "2.5": {
      addReferenceSecondsToOutput: true,
      resolutions: {
        "480p": { withoutReferencePerSec: 20, withReferencePerSec: null },
        "720p": { withoutReferencePerSec: 46, withReferencePerSec: null },
        "1080p": { withoutReferencePerSec: 110, withReferencePerSec: null },
      },
    },
  },
  plans: [
    { id: "standard-monthly", credits: 1500, priceYuan: 59 },
    { id: "supreme-monthly", credits: 66000, priceYuan: 2299 },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function readResolutionRate(
  value: unknown,
  fallback: LibtvResolutionRate
): LibtvResolutionRate {
  if (!isRecord(value)) {
    return fallback;
  }
  const without =
    readPositiveNumber(value.withoutReferencePerSec) ??
    fallback.withoutReferencePerSec;
  const withRaw = value.withReferencePerSec;
  const withReferencePerSec =
    withRaw === null
      ? null
      : (readPositiveNumber(withRaw) ?? fallback.withReferencePerSec);
  return {
    withoutReferencePerSec: without,
    withReferencePerSec,
  };
}

function readSeriesRates(
  value: unknown,
  fallback: LibtvSeriesRates
): LibtvSeriesRates {
  const source = isRecord(value) ? value : {};
  const resolutionsSource = isRecord(source.resolutions)
    ? source.resolutions
    : {};
  const resolutions: Record<string, LibtvResolutionRate> = {};
  const keys = new Set([
    ...Object.keys(fallback.resolutions),
    ...Object.keys(resolutionsSource),
  ]);
  for (const key of keys) {
    const normalized = key.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    resolutions[normalized] = readResolutionRate(
      resolutionsSource[key] ?? resolutionsSource[normalized],
      fallback.resolutions[normalized] ?? {
        withoutReferencePerSec: 1,
        withReferencePerSec: null,
      }
    );
  }
  return {
    addReferenceSecondsToOutput:
      typeof source.addReferenceSecondsToOutput === "boolean"
        ? source.addReferenceSecondsToOutput
        : fallback.addReferenceSecondsToOutput,
    resolutions,
  };
}

function readPlan(value: unknown, fallback: LibtvPlan): LibtvPlan | null {
  if (!isRecord(value)) {
    return fallback;
  }
  const id = value.id;
  if (id !== "standard-monthly" && id !== "supreme-monthly") {
    return null;
  }
  const credits = readPositiveNumber(value.credits) ?? fallback.credits;
  const priceYuan = readPositiveNumber(value.priceYuan) ?? fallback.priceYuan;
  return { id, credits, priceYuan };
}

export function mergeLibtvComparisonConfig(
  value: unknown
): LibtvComparisonConfig {
  const source = isRecord(value) ? value : {};
  const seriesSource = isRecord(source.series) ? source.series : {};
  const plansSource = Array.isArray(source.plans) ? source.plans : [];
  const plansById = new Map<LibtvPlanId, LibtvPlan>();
  for (const fallback of DEFAULT_LIBTV_COMPARISON_CONFIG.plans) {
    plansById.set(fallback.id, fallback);
  }
  for (const entry of plansSource) {
    const fallback =
      isRecord(entry) &&
      (entry.id === "standard-monthly" || entry.id === "supreme-monthly")
        ? (plansById.get(entry.id) ?? DEFAULT_LIBTV_COMPARISON_CONFIG.plans[0])
        : DEFAULT_LIBTV_COMPARISON_CONFIG.plans[0];
    const plan = readPlan(entry, fallback);
    if (plan) {
      plansById.set(plan.id, plan);
    }
  }

  return {
    series: {
      "2.0": readSeriesRates(
        seriesSource["2.0"],
        DEFAULT_LIBTV_COMPARISON_CONFIG.series["2.0"]
      ),
      "2.5": readSeriesRates(
        seriesSource["2.5"],
        DEFAULT_LIBTV_COMPARISON_CONFIG.series["2.5"]
      ),
    },
    plans: LIBTV_PLAN_IDS.map(
      (id) => plansById.get(id) ?? DEFAULT_LIBTV_COMPARISON_CONFIG.plans[0]
    ),
  };
}

export function parseLibtvComparisonConfig(
  value: string | null | undefined
): LibtvComparisonConfig {
  if (!value) {
    return DEFAULT_LIBTV_COMPARISON_CONFIG;
  }
  try {
    return mergeLibtvComparisonConfig(JSON.parse(value));
  } catch {
    return DEFAULT_LIBTV_COMPARISON_CONFIG;
  }
}

export interface LibtvCreditsInput {
  readonly config: LibtvComparisonConfig;
  readonly canonicalId: string;
  readonly resolution: string;
  readonly outputDurationSec: number;
  readonly referenceDurationSec: number;
}

export function computeLibtvCredits(input: LibtvCreditsInput): number | null {
  if (input.outputDurationSec <= 0) {
    return null;
  }
  const series = resolveSeedanceSeries(input.canonicalId);
  const seriesRates = input.config.series[series];
  const rate = seriesRates.resolutions[input.resolution.trim().toLowerCase()];
  if (!rate) {
    return null;
  }

  const hasReference = input.referenceDurationSec > 0;
  if (seriesRates.addReferenceSecondsToOutput) {
    const billedSeconds =
      input.outputDurationSec +
      (hasReference ? input.referenceDurationSec : 0);
    return Math.round(rate.withoutReferencePerSec * billedSeconds);
  }

  const perSecond =
    hasReference && rate.withReferencePerSec != null
      ? rate.withReferencePerSec
      : rate.withoutReferencePerSec;
  return Math.round(perSecond * input.outputDurationSec);
}

export function computeLibtvConvertedYuan(
  credits: number,
  plan: LibtvPlan
): number | null {
  if (credits <= 0 || plan.credits <= 0 || plan.priceYuan <= 0) {
    return null;
  }
  return (credits / plan.credits) * plan.priceYuan;
}
