import {
  type LibtvPricePromo,
  readLibtvPricePromos,
} from "./video-price-promo";

const LEGACY_LIBTV_PLAN_NAMES: Readonly<Record<string, string>> = {
  "standard-monthly": "标准",
  "supreme-monthly": "至尊版",
};

export const LIBTV_RATE_MODEL_IDS = [
  "doubao-seedance-2",
  "doubao-seedance-2-fast",
  "doubao-seedance-2-mini",
  "doubao-seedance-2-5",
] as const;

export type LibtvRateModelId = (typeof LIBTV_RATE_MODEL_IDS)[number];

export const LIBTV_RATE_RESOLUTIONS = ["480p", "720p", "1080p", "4k"] as const;

export type LibtvRateResolution = (typeof LIBTV_RATE_RESOLUTIONS)[number];

export interface LibtvPlan {
  readonly id: string;
  readonly name: string;
  readonly credits: number;
  readonly priceYuan: number;
}

export function createLibtvPlanId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
  readonly series: Readonly<Record<LibtvRateModelId, LibtvSeriesRates>>;
  readonly plans: readonly LibtvPlan[];
  readonly promos: readonly LibtvPricePromo[];
}

export const LANDING_VOLCANO_MIN_RECHARGE_YUAN = 200 as const;

const DEFAULT_SEEDANCE_2_RATES: LibtvSeriesRates = {
  addReferenceSecondsToOutput: false,
  resolutions: {
    "480p": { withoutReferencePerSec: 13, withReferencePerSec: 20 },
    "720p": { withoutReferencePerSec: 27, withReferencePerSec: 49 },
    "1080p": { withoutReferencePerSec: 68, withReferencePerSec: 110 },
    "4k": { withoutReferencePerSec: 140, withReferencePerSec: 260 },
  },
};

const DEFAULT_SEEDANCE_2_FAST_RATES: LibtvSeriesRates = {
  addReferenceSecondsToOutput: false,
  resolutions: {
    "480p": { withoutReferencePerSec: 10, withReferencePerSec: 16 },
    "720p": { withoutReferencePerSec: 22, withReferencePerSec: 41 },
  },
};

const DEFAULT_SEEDANCE_2_MINI_RATES: LibtvSeriesRates = {
  addReferenceSecondsToOutput: false,
  resolutions: {
    "480p": { withoutReferencePerSec: 8, withReferencePerSec: 9 },
    "720p": { withoutReferencePerSec: 16, withReferencePerSec: 20 },
  },
};

const DEFAULT_SEEDANCE_25_RATES: LibtvSeriesRates = {
  addReferenceSecondsToOutput: true,
  resolutions: {
    "480p": { withoutReferencePerSec: 20, withReferencePerSec: null },
    "720p": { withoutReferencePerSec: 46, withReferencePerSec: null },
    "1080p": { withoutReferencePerSec: 110, withReferencePerSec: null },
  },
};

function cloneLibtvSeriesRates(rates: LibtvSeriesRates): LibtvSeriesRates {
  const resolutions: Record<string, LibtvResolutionRate> = {};
  for (const [key, rate] of Object.entries(rates.resolutions)) {
    resolutions[key] = { ...rate };
  }
  return {
    addReferenceSecondsToOutput: rates.addReferenceSecondsToOutput,
    resolutions,
  };
}

export function resolveLibtvRateModelId(canonicalId: string): LibtvRateModelId {
  const id = canonicalId.trim().toLowerCase();
  if (id.includes("2-5") || id.includes("2.5")) {
    return "doubao-seedance-2-5";
  }
  if (id.includes("fast")) {
    return "doubao-seedance-2-fast";
  }
  if (id.includes("mini")) {
    return "doubao-seedance-2-mini";
  }
  return "doubao-seedance-2";
}

export const DEFAULT_LIBTV_COMPARISON_CONFIG: LibtvComparisonConfig = {
  series: {
    "doubao-seedance-2": cloneLibtvSeriesRates(DEFAULT_SEEDANCE_2_RATES),
    "doubao-seedance-2-fast": cloneLibtvSeriesRates(
      DEFAULT_SEEDANCE_2_FAST_RATES
    ),
    "doubao-seedance-2-mini": cloneLibtvSeriesRates(
      DEFAULT_SEEDANCE_2_MINI_RATES
    ),
    "doubao-seedance-2-5": cloneLibtvSeriesRates(DEFAULT_SEEDANCE_25_RATES),
  },
  plans: [
    { id: "standard-monthly", name: "标准", credits: 1500, priceYuan: 59 },
    { id: "supreme-monthly", name: "进阶", credits: 4600, priceYuan: 199 },
    {
      id: "74c0dc1d-bc04-4414-b6de-581ee929ab50",
      name: "高级1",
      credits: 11700,
      priceYuan: 469,
    },
    {
      id: "6fef8318-d95c-4992-a1d6-198191ffb3a6",
      name: "高级2",
      credits: 16300,
      priceYuan: 649,
    },
    {
      id: "76529922-831a-405d-b81b-74f0787d36d4",
      name: "豪华",
      credits: 32800,
      priceYuan: 1199,
    },
    {
      id: "98806e9f-85c1-4a61-9d8b-5d76ef34233d",
      name: "至尊1",
      credits: 50500,
      priceYuan: 1799,
    },
    {
      id: "e47b6ac7-9a0d-4c87-8460-5adaed8ee20a",
      name: "至尊2",
      credits: 66000,
      priceYuan: 2299,
    },
  ],
  promos: [
    {
      id: "0837a1b9-39a7-475e-9130-1ee39b3849f1",
      canonicalId: "doubao-seedance-2-mini",
      resolution: "any",
      withReference: false,
      startsAt: "2026-08-07",
      endsAt: "2026-09-07",
      discountFold: 4,
    },
    {
      id: "5133c6a0-c797-41dc-9472-72ab5a66a49a",
      canonicalId: "doubao-seedance-2-fast",
      resolution: "any",
      withReference: false,
      startsAt: "2026-08-07",
      endsAt: "2026-09-07",
      discountFold: 7.5,
    },
    {
      id: "0b3a8085-3e4a-4290-9377-30c3e07afb4c",
      canonicalId: "doubao-seedance-2-5",
      resolution: "720p",
      withReference: true,
      startsAt: "2026-08-07",
      endsAt: "2026-09-17",
      discountFold: 5.8,
    },
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

function readResolutionRate(value: unknown): LibtvResolutionRate | null {
  if (!isRecord(value)) {
    return null;
  }
  const without = readPositiveNumber(value.withoutReferencePerSec);
  if (without == null) {
    return null;
  }
  const withRaw = value.withReferencePerSec;
  return {
    withoutReferencePerSec: without,
    withReferencePerSec:
      withRaw === null || withRaw === undefined
        ? null
        : (readPositiveNumber(withRaw) ?? null),
  };
}

function readSeriesRates(
  value: unknown,
  fallback: LibtvSeriesRates
): LibtvSeriesRates {
  if (!isRecord(value)) {
    return cloneLibtvSeriesRates(fallback);
  }
  const addReferenceSecondsToOutput =
    typeof value.addReferenceSecondsToOutput === "boolean"
      ? value.addReferenceSecondsToOutput
      : fallback.addReferenceSecondsToOutput;
  if (!isRecord(value.resolutions)) {
    return {
      addReferenceSecondsToOutput,
      resolutions: cloneLibtvSeriesRates(fallback).resolutions,
    };
  }
  const resolutions: Record<string, LibtvResolutionRate> = {};
  for (const key of Object.keys(value.resolutions)) {
    const normalized = key.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    const rate = readResolutionRate(value.resolutions[key]);
    if (rate) {
      resolutions[normalized] = rate;
    }
  }
  return {
    addReferenceSecondsToOutput,
    resolutions,
  };
}

function defaultNameForPlanId(id: string): string {
  return LEGACY_LIBTV_PLAN_NAMES[id] ?? id;
}

function readPlanName(value: unknown, id: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return defaultNameForPlanId(id);
}

function readPlan(value: unknown): LibtvPlan | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) {
    return null;
  }
  const credits = readPositiveNumber(value.credits);
  const priceYuan = readPositiveNumber(value.priceYuan);
  if (credits == null || priceYuan == null) {
    return null;
  }
  return {
    id,
    name: readPlanName(value.name, id),
    credits,
    priceYuan,
  };
}

function readPlans(value: unknown): readonly LibtvPlan[] {
  if (!Array.isArray(value)) {
    return DEFAULT_LIBTV_COMPARISON_CONFIG.plans;
  }
  const plans: LibtvPlan[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const plan = readPlan(entry);
    if (!plan || seen.has(plan.id)) {
      continue;
    }
    seen.add(plan.id);
    plans.push(plan);
  }
  return plans.length > 0 ? plans : DEFAULT_LIBTV_COMPARISON_CONFIG.plans;
}

function readSeriesSource(
  seriesSource: Record<string, unknown>,
  modelId: LibtvRateModelId
): unknown {
  if (modelId in seriesSource) {
    return seriesSource[modelId];
  }
  if (modelId === "doubao-seedance-2") {
    return seriesSource["2.0"];
  }
  if (modelId === "doubao-seedance-2-5") {
    return seriesSource["2.5"];
  }
  return undefined;
}

export function mergeLibtvComparisonConfig(
  value: unknown
): LibtvComparisonConfig {
  const source = isRecord(value) ? value : {};
  const seriesSource = isRecord(source.series) ? source.series : {};
  const seedance2 = readSeriesRates(
    readSeriesSource(seriesSource, "doubao-seedance-2"),
    DEFAULT_LIBTV_COMPARISON_CONFIG.series["doubao-seedance-2"]
  );

  return {
    series: {
      "doubao-seedance-2": seedance2,
      "doubao-seedance-2-fast": readSeriesRates(
        readSeriesSource(seriesSource, "doubao-seedance-2-fast"),
        seedance2
      ),
      "doubao-seedance-2-mini": readSeriesRates(
        readSeriesSource(seriesSource, "doubao-seedance-2-mini"),
        seedance2
      ),
      "doubao-seedance-2-5": readSeriesRates(
        readSeriesSource(seriesSource, "doubao-seedance-2-5"),
        DEFAULT_LIBTV_COMPARISON_CONFIG.series["doubao-seedance-2-5"]
      ),
    },
    plans: readPlans(source.plans),
    promos: readLibtvPricePromos(source.promos),
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
  const modelId = resolveLibtvRateModelId(input.canonicalId);
  const seriesRates = input.config.series[modelId];
  const rate = seriesRates?.resolutions[input.resolution.trim().toLowerCase()];
  if (!rate) {
    return null;
  }

  const hasReference = input.referenceDurationSec > 0;
  if (seriesRates.addReferenceSecondsToOutput) {
    const billedSeconds =
      input.outputDurationSec + (hasReference ? input.referenceDurationSec : 0);
    return Math.round(rate.withoutReferencePerSec * billedSeconds);
  }

  const perSecond =
    hasReference && rate.withReferencePerSec != null
      ? rate.withReferencePerSec
      : rate.withoutReferencePerSec;
  return Math.round(perSecond * input.outputDurationSec);
}

export interface LibtvClipSplitCredits {
  readonly referencedCredits: number;
  readonly plainCredits: number;
}

export function computeLibtvCreditsForClipSplit(input: {
  readonly config: LibtvComparisonConfig;
  readonly canonicalId: string;
  readonly resolution: string;
  readonly referencedOutputSec: number;
  readonly plainOutputSec: number;
  readonly referenceDurationSec: number;
}): LibtvClipSplitCredits | null {
  const hasRef =
    input.referencedOutputSec > 0 && input.referenceDurationSec > 0;
  const referencedOutputSec = hasRef ? input.referencedOutputSec : 0;
  const plainOutputSec =
    input.plainOutputSec +
    (hasRef ? 0 : Math.max(0, input.referencedOutputSec));

  const readPart = (
    outputDurationSec: number,
    referenceDurationSec: number
  ): number | null => {
    if (outputDurationSec <= 0) {
      return 0;
    }
    return computeLibtvCredits({
      config: input.config,
      canonicalId: input.canonicalId,
      resolution: input.resolution,
      outputDurationSec,
      referenceDurationSec,
    });
  };

  const referencedCredits = readPart(
    referencedOutputSec,
    input.referenceDurationSec
  );
  const plainCredits = readPart(plainOutputSec, 0);
  if (referencedCredits == null || plainCredits == null) {
    return null;
  }
  return { referencedCredits, plainCredits };
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

export function matchLowestCoveringPlan<T extends { readonly credits: number }>(
  plans: readonly T[],
  neededCredits: number
): T | null {
  if (plans.length === 0) {
    return null;
  }
  const sorted = [...plans].sort((a, b) => a.credits - b.credits);
  return (
    sorted.find((plan) => plan.credits >= neededCredits) ??
    sorted[sorted.length - 1] ??
    null
  );
}

export function computePlanAccountCount(
  neededCredits: number,
  planCredits: number
): number {
  if (neededCredits <= 0 || planCredits <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(neededCredits / planCredits));
}
