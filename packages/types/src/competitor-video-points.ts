import {
  isVideoPricePromoDate,
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

export const LIBTV_PLAN_CYCLES = ["monthly", "quarterly", "yearly"] as const;

export type LibtvPlanCycle = (typeof LIBTV_PLAN_CYCLES)[number];

export const LIBTV_PLAN_CYCLE_MONTHS: Readonly<Record<LibtvPlanCycle, number>> =
  {
    monthly: 1,
    quarterly: 3,
    yearly: 12,
  };

export interface LibtvPlan {
  readonly id: string;
  readonly name: string;
  readonly credits: number;
  readonly priceYuan: number;
  readonly quarterPriceYuan: number | null;
  readonly yearPriceYuan: number | null;
}

export interface LibtvPlanCyclePrice {
  readonly cycle: LibtvPlanCycle;
  readonly months: number;
  readonly totalYuan: number;
  readonly monthlyYuan: number;
}

export function readLibtvPlanCyclePrice(
  plan: LibtvPlan,
  cycle: LibtvPlanCycle
): LibtvPlanCyclePrice | null {
  const months = LIBTV_PLAN_CYCLE_MONTHS[cycle];
  const totalYuan =
    cycle === "monthly"
      ? plan.priceYuan
      : cycle === "quarterly"
        ? plan.quarterPriceYuan
        : plan.yearPriceYuan;
  if (totalYuan == null || totalYuan <= 0) {
    return null;
  }
  return {
    cycle,
    months,
    totalYuan,
    monthlyYuan: totalYuan / months,
  };
}

export function libtvPlansForCycle(
  plans: readonly LibtvPlan[],
  cycle: LibtvPlanCycle
): readonly LibtvPlan[] {
  return plans.filter((plan) => readLibtvPlanCyclePrice(plan, cycle) != null);
}

export function libtvPlanCyclesWithPrice(
  plans: readonly LibtvPlan[]
): readonly LibtvPlanCycle[] {
  return LIBTV_PLAN_CYCLES.filter(
    (cycle) => libtvPlansForCycle(plans, cycle).length > 0
  );
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
  readonly independentReferencePrice: boolean;
  readonly resolutions: Readonly<Record<string, LibtvResolutionRate>>;
}

export interface LibtvComparisonConfig {
  readonly series: Readonly<Record<LibtvRateModelId, LibtvSeriesRates>>;
  readonly plans: readonly LibtvPlan[];
  readonly promos: readonly LibtvPricePromo[];
}

export const LIBTV_COMPETITOR_ID = "libtv" as const;
export const DEFAULT_LIBTV_COMPETITOR_NAME = "LibTV" as const;

export const VIDEO_PRICE_COMPETITOR_KIND_COMPARE = "compare" as const;
export const VIDEO_PRICE_COMPETITOR_KIND_PROMO_NOTE = "promoNote" as const;

export interface VideoPriceCompetitorLink {
  readonly showUrl: boolean;
  readonly url: string;
}

export interface VideoPriceCompareCompetitor extends VideoPriceCompetitorLink {
  readonly id: string;
  readonly name: string;
  readonly kind: typeof VIDEO_PRICE_COMPETITOR_KIND_COMPARE;
  readonly config: LibtvComparisonConfig;
}

export interface VideoPricePromoNoteCompetitor
  extends VideoPriceCompetitorLink {
  readonly id: string;
  readonly name: string;
  readonly kind: typeof VIDEO_PRICE_COMPETITOR_KIND_PROMO_NOTE;
  readonly text: string;
  readonly showDates: boolean;
  readonly startsAt: string;
  readonly endsAt: string;
}

export type VideoPriceCompetitor =
  | VideoPriceCompareCompetitor
  | VideoPricePromoNoteCompetitor;

export function isVideoPriceCompareCompetitor(
  competitor: VideoPriceCompetitor
): competitor is VideoPriceCompareCompetitor {
  return competitor.kind === VIDEO_PRICE_COMPETITOR_KIND_COMPARE;
}

export function isVideoPricePromoNoteCompetitor(
  competitor: VideoPriceCompetitor
): competitor is VideoPricePromoNoteCompetitor {
  return competitor.kind === VIDEO_PRICE_COMPETITOR_KIND_PROMO_NOTE;
}

export function isVideoPriceCompetitorHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function readVideoPriceCompetitorUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return isVideoPriceCompetitorHttpUrl(trimmed) ? trimmed : "";
}

export function readVideoPriceCompetitorPublicUrl(
  competitor: VideoPriceCompetitorLink
): string | null {
  if (!competitor.showUrl) {
    return null;
  }
  return isVideoPriceCompetitorHttpUrl(competitor.url) ? competitor.url : null;
}

export interface VideoPriceCompetitorStore {
  readonly competitors: readonly VideoPriceCompetitor[];
}

export function createVideoPriceCompetitorId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `competitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const LANDING_VOLCANO_MIN_RECHARGE_YUAN = 200 as const;

const DEFAULT_SEEDANCE_2_RATES: LibtvSeriesRates = {
  addReferenceSecondsToOutput: false,
  independentReferencePrice: true,
  resolutions: {
    "480p": { withoutReferencePerSec: 13, withReferencePerSec: 20 },
    "720p": { withoutReferencePerSec: 27, withReferencePerSec: 49 },
    "1080p": { withoutReferencePerSec: 68, withReferencePerSec: 110 },
    "4k": { withoutReferencePerSec: 140, withReferencePerSec: 260 },
  },
};

const DEFAULT_SEEDANCE_2_FAST_RATES: LibtvSeriesRates = {
  addReferenceSecondsToOutput: false,
  independentReferencePrice: true,
  resolutions: {
    "480p": { withoutReferencePerSec: 10, withReferencePerSec: 16 },
    "720p": { withoutReferencePerSec: 22, withReferencePerSec: 41 },
  },
};

const DEFAULT_SEEDANCE_2_MINI_RATES: LibtvSeriesRates = {
  addReferenceSecondsToOutput: false,
  independentReferencePrice: true,
  resolutions: {
    "480p": { withoutReferencePerSec: 8, withReferencePerSec: 9 },
    "720p": { withoutReferencePerSec: 16, withReferencePerSec: 20 },
  },
};

const DEFAULT_SEEDANCE_25_RATES: LibtvSeriesRates = {
  addReferenceSecondsToOutput: true,
  independentReferencePrice: false,
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
    independentReferencePrice: rates.independentReferencePrice,
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
    {
      id: "standard-monthly",
      name: "标准",
      credits: 1500,
      priceYuan: 59,
      quarterPriceYuan: 179,
      yearPriceYuan: 569,
    },
    {
      id: "supreme-monthly",
      name: "进阶",
      credits: 4600,
      priceYuan: 199,
      quarterPriceYuan: 499,
      yearPriceYuan: 1199,
    },
    {
      id: "74c0dc1d-bc04-4414-b6de-581ee929ab50",
      name: "高级1",
      credits: 11700,
      priceYuan: 469,
      quarterPriceYuan: 1159,
      yearPriceYuan: 2999,
    },
    {
      id: "6fef8318-d95c-4992-a1d6-198191ffb3a6",
      name: "高级2",
      credits: 16300,
      priceYuan: 649,
      quarterPriceYuan: 1599,
      yearPriceYuan: 3999,
    },
    {
      id: "76529922-831a-405d-b81b-74f0787d36d4",
      name: "豪华",
      credits: 32800,
      priceYuan: 1199,
      quarterPriceYuan: 2699,
      yearPriceYuan: 6999,
    },
    {
      id: "98806e9f-85c1-4a61-9d8b-5d76ef34233d",
      name: "至尊1",
      credits: 50500,
      priceYuan: 1799,
      quarterPriceYuan: 3899,
      yearPriceYuan: 9499,
    },
    {
      id: "e47b6ac7-9a0d-4c87-8460-5adaed8ee20a",
      name: "至尊2",
      credits: 66000,
      priceYuan: 2299,
      quarterPriceYuan: 4999,
      yearPriceYuan: 11999,
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
  const independentReferencePrice =
    typeof value.independentReferencePrice === "boolean"
      ? value.independentReferencePrice
      : !addReferenceSecondsToOutput;
  if (!isRecord(value.resolutions)) {
    return {
      addReferenceSecondsToOutput,
      independentReferencePrice,
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
    independentReferencePrice,
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
    quarterPriceYuan: readPositiveNumber(value.quarterPriceYuan),
    yearPriceYuan: readPositiveNumber(value.yearPriceYuan),
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

const DEFAULT_JIMENG_COMPARISON_CONFIG: LibtvComparisonConfig = {
  series: {
    "doubao-seedance-2": {
      addReferenceSecondsToOutput: true,
      independentReferencePrice: false,
      resolutions: {
        "720p": { withoutReferencePerSec: 14, withReferencePerSec: null },
        "1080p": { withoutReferencePerSec: 33, withReferencePerSec: null },
        "4k": { withoutReferencePerSec: 80, withReferencePerSec: null },
      },
    },
    "doubao-seedance-2-fast": {
      addReferenceSecondsToOutput: true,
      independentReferencePrice: false,
      resolutions: {
        "720p": { withoutReferencePerSec: 11, withReferencePerSec: null },
      },
    },
    "doubao-seedance-2-mini": {
      addReferenceSecondsToOutput: true,
      independentReferencePrice: false,
      resolutions: {
        "720p": { withoutReferencePerSec: 9, withReferencePerSec: null },
      },
    },
    "doubao-seedance-2-5": {
      addReferenceSecondsToOutput: true,
      independentReferencePrice: false,
      resolutions: {
        "480p": { withoutReferencePerSec: 12, withReferencePerSec: null },
        "720p": { withoutReferencePerSec: 26, withReferencePerSec: null },
        "1080p": { withoutReferencePerSec: 64, withReferencePerSec: null },
      },
    },
  },
  plans: [
    {
      id: "fc2b510e-47dd-4d77-8c79-516983b11bdb",
      name: "基础",
      credits: 725,
      priceYuan: 41,
      quarterPriceYuan: 188,
      yearPriceYuan: 393,
    },
    {
      id: "13d0b45d-8cdc-4f28-9117-d033d140628d",
      name: "标准",
      credits: 2210,
      priceYuan: 199,
      quarterPriceYuan: 568,
      yearPriceYuan: 1099,
    },
    {
      id: "b20cfc63-794a-4fd2-a658-a146ebfce437",
      name: "高级1",
      credits: 6160,
      priceYuan: 499,
      quarterPriceYuan: 1399,
      yearPriceYuan: 3099,
    },
    {
      id: "878aa6fc-bd63-4694-8b89-c1cb88eae987",
      name: "高级2",
      credits: 12320,
      priceYuan: 998,
      quarterPriceYuan: 1959,
      yearPriceYuan: 7278,
    },
    {
      id: "da0abbac-75fa-4ac2-a250-dce4ae95cd13",
      name: "高级3",
      credits: 18480,
      priceYuan: 1498,
      quarterPriceYuan: 2939,
      yearPriceYuan: 10918,
    },
    {
      id: "3d78dd50-e7b5-4d1e-8aab-0ee449cf158d",
      name: "高级4",
      credits: 27720,
      priceYuan: 2246,
      quarterPriceYuan: 4409,
      yearPriceYuan: 16378,
    },
    {
      id: "c4952357-e9c4-47e9-906c-9e809ef23743",
      name: "超级",
      credits: 54600,
      priceYuan: 4299,
      quarterPriceYuan: 8189,
      yearPriceYuan: 30576,
    },
  ],
  promos: [],
};

const DEFAULT_XIAOYUNQUE_COMPARISON_CONFIG: LibtvComparisonConfig = {
  series: {
    "doubao-seedance-2": {
      addReferenceSecondsToOutput: true,
      independentReferencePrice: false,
      resolutions: {
        "480p": { withoutReferencePerSec: 8, withReferencePerSec: null },
        "720p": { withoutReferencePerSec: 14, withReferencePerSec: null },
        "1080p": { withoutReferencePerSec: 33, withReferencePerSec: null },
        "4k": { withoutReferencePerSec: 80, withReferencePerSec: null },
      },
    },
    "doubao-seedance-2-fast": {
      addReferenceSecondsToOutput: true,
      independentReferencePrice: false,
      resolutions: {
        "480p": { withoutReferencePerSec: 3, withReferencePerSec: null },
        "720p": { withoutReferencePerSec: 6, withReferencePerSec: null },
      },
    },
    "doubao-seedance-2-mini": {
      addReferenceSecondsToOutput: true,
      independentReferencePrice: false,
      resolutions: {
        "480p": { withoutReferencePerSec: 4, withReferencePerSec: null },
      },
    },
    "doubao-seedance-2-5": {
      addReferenceSecondsToOutput: true,
      independentReferencePrice: true,
      resolutions: {
        "480p": { withoutReferencePerSec: 12, withReferencePerSec: 9 },
        "720p": { withoutReferencePerSec: 26, withReferencePerSec: 19 },
        "1080p": { withoutReferencePerSec: 64, withReferencePerSec: 64 },
      },
    },
  },
  plans: [
    {
      id: "8d8c359b-f797-4d37-a4f8-ee026d51fbf9",
      name: "基础",
      credits: 830,
      priceYuan: 49,
      quarterPriceYuan: 219,
      yearPriceYuan: 453,
    },
    {
      id: "ea49a905-92ef-40c9-90a3-2e753c49a0c6",
      name: "标准",
      credits: 2320,
      priceYuan: 125,
      quarterPriceYuan: 589,
      yearPriceYuan: 1199,
    },
    {
      id: "3f663615-3fd1-4eca-ba55-03163e3fcbae",
      name: "高级1",
      credits: 6330,
      priceYuan: 318,
      quarterPriceYuan: 1488,
      yearPriceYuan: 3188,
    },
    {
      id: "d87880d8-7e42-4432-ba65-05979bcd3625",
      name: "高级2",
      credits: 8600,
      priceYuan: 433,
      quarterPriceYuan: 1999,
      yearPriceYuan: 4319,
    },
    {
      id: "244c52e1-38a6-4c06-87dc-ea696acc3657",
      name: "高级3",
      credits: 10150,
      priceYuan: 509,
      quarterPriceYuan: 2349,
      yearPriceYuan: 5099,
    },
    {
      id: "8e57dee4-eaec-43ad-a72b-0dcb43041617",
      name: "高级4",
      credits: 12000,
      priceYuan: 999,
      quarterPriceYuan: 1959,
      yearPriceYuan: 6999,
    },
    {
      id: "8a6ce4b0-c3e9-4d15-8b96-f905a784c3cf",
      name: "高级5",
      credits: 18480,
      priceYuan: 1498,
      quarterPriceYuan: 2939,
      yearPriceYuan: 10918,
    },
    {
      id: "d04a4c81-6187-4070-8b34-2e160bb05196",
      name: "高级6",
      credits: 27720,
      priceYuan: 2246,
      quarterPriceYuan: 4408,
      yearPriceYuan: 16378,
    },
    {
      id: "93147517-876d-41a4-9160-88263a52b00d",
      name: "超级",
      credits: 54600,
      priceYuan: 4299,
      quarterPriceYuan: 8189,
      yearPriceYuan: 30576,
    },
  ],
  promos: [],
};

export const DEFAULT_VIDEO_PRICE_COMPETITOR_STORE: VideoPriceCompetitorStore = {
  competitors: [
    {
      id: LIBTV_COMPETITOR_ID,
      name: DEFAULT_LIBTV_COMPETITOR_NAME,
      kind: VIDEO_PRICE_COMPETITOR_KIND_COMPARE,
      showUrl: false,
      url: "",
      config: DEFAULT_LIBTV_COMPARISON_CONFIG,
    },
    {
      id: "14f0717b-314f-4e2b-a27d-457977a6adc0",
      name: "像塑",
      kind: VIDEO_PRICE_COMPETITOR_KIND_PROMO_NOTE,
      showUrl: true,
      url: "https://effect.douyin.com/",
      text: "【有水印】seedance2.0【mini】无限量生成，下载->建项目->AI效果->视频生成，参考913 至少要使用一张图片参考",
      showDates: false,
      startsAt: "2026-08-18",
      endsAt: "2026-08-18",
    },
    {
      id: "ec3b7886-b9c6-415d-86bf-c6deb4709143",
      name: "即梦",
      kind: VIDEO_PRICE_COMPETITOR_KIND_COMPARE,
      showUrl: false,
      url: "",
      config: DEFAULT_JIMENG_COMPARISON_CONFIG,
    },
    {
      id: "578f85a3-abcb-4bfd-92c9-559757fe019c",
      name: "小云雀",
      kind: VIDEO_PRICE_COMPETITOR_KIND_COMPARE,
      showUrl: false,
      url: "",
      config: DEFAULT_XIAOYUNQUE_COMPARISON_CONFIG,
    },
  ],
};

export function defaultVideoPriceCompetitorStore(): VideoPriceCompetitorStore {
  return DEFAULT_VIDEO_PRICE_COMPETITOR_STORE;
}

function readCompetitorName(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function readPromoNoteDate(value: unknown): string {
  return typeof value === "string" && isVideoPricePromoDate(value) ? value : "";
}

function readCompetitorLink(
  value: Record<string, unknown>
): VideoPriceCompetitorLink {
  return {
    showUrl: value.showUrl === true,
    url: readVideoPriceCompetitorUrl(value.url),
  };
}

function readCompetitor(value: unknown): VideoPriceCompetitor | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) {
    return null;
  }
  const name = readCompetitorName(
    value.name,
    id === LIBTV_COMPETITOR_ID ? DEFAULT_LIBTV_COMPETITOR_NAME : id
  );
  const link = readCompetitorLink(value);
  if (value.kind === VIDEO_PRICE_COMPETITOR_KIND_PROMO_NOTE) {
    return {
      id,
      name,
      kind: VIDEO_PRICE_COMPETITOR_KIND_PROMO_NOTE,
      ...link,
      text: typeof value.text === "string" ? value.text.trim() : "",
      showDates: value.showDates === true,
      startsAt: readPromoNoteDate(value.startsAt),
      endsAt: readPromoNoteDate(value.endsAt),
    };
  }
  return {
    id,
    name,
    kind: VIDEO_PRICE_COMPETITOR_KIND_COMPARE,
    ...link,
    config: mergeLibtvComparisonConfig(value.config ?? value),
  };
}

export function readVideoPriceCompetitors(
  value: unknown
): readonly VideoPriceCompetitor[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const competitors: VideoPriceCompetitor[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const competitor = readCompetitor(entry);
    if (!competitor || seen.has(competitor.id)) {
      continue;
    }
    seen.add(competitor.id);
    competitors.push(competitor);
  }
  return competitors;
}

export function mergeVideoPriceCompetitorStore(
  value: unknown
): VideoPriceCompetitorStore {
  if (!isRecord(value)) {
    return defaultVideoPriceCompetitorStore();
  }
  if (Array.isArray(value.competitors)) {
    return { competitors: readVideoPriceCompetitors(value.competitors) };
  }
  if (isRecord(value.series) || Array.isArray(value.plans)) {
    return {
      competitors: [
        {
          id: LIBTV_COMPETITOR_ID,
          name: DEFAULT_LIBTV_COMPETITOR_NAME,
          kind: VIDEO_PRICE_COMPETITOR_KIND_COMPARE,
          showUrl: false,
          url: "",
          config: mergeLibtvComparisonConfig(value),
        },
      ],
    };
  }
  return defaultVideoPriceCompetitorStore();
}

export function parseVideoPriceCompetitorStore(
  value: string | null | undefined
): VideoPriceCompetitorStore {
  if (!value) {
    return defaultVideoPriceCompetitorStore();
  }
  try {
    return mergeVideoPriceCompetitorStore(JSON.parse(value));
  } catch {
    return defaultVideoPriceCompetitorStore();
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
  const billedSeconds =
    seriesRates.addReferenceSecondsToOutput && hasReference
      ? input.outputDurationSec + input.referenceDurationSec
      : input.outputDurationSec;
  const perSecond =
    hasReference &&
    seriesRates.independentReferencePrice &&
    rate.withReferencePerSec != null
      ? rate.withReferencePerSec
      : rate.withoutReferencePerSec;
  return Math.round(perSecond * billedSeconds);
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
  plan: LibtvPlan,
  cycle: LibtvPlanCycle = "monthly"
): number | null {
  const priced = readLibtvPlanCyclePrice(plan, cycle);
  if (credits <= 0 || plan.credits <= 0 || priced == null) {
    return null;
  }
  return (credits / plan.credits) * priced.monthlyYuan;
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
