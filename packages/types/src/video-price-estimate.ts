import {
  DEFAULT_HOMEPAGE_VIDEO_SCENARIOS,
  readHomepageVideoScenarios,
  type HomepageVideoScenario,
} from "./homepage-video-scenario";
import {
  readVideoPriceCompetitors,
  type VideoPriceCompetitor,
} from "./competitor-video-points";
import type {
  PlatformAiModelParameterRules,
  VideoModelParameterRules,
  VideoModelPriceEstimateConfig,
  VideoModelPriceEstimateTier,
  VideoPriceEstimateResolution,
} from "./platform-ai-model";
import {
  isVideoModelParameterRules,
  resolveDurationOptions,
  VIDEO_DURATION_MAX,
  VIDEO_PRICE_ESTIMATE_RESOLUTIONS,
} from "./platform-ai-model";
import {
  getSeedanceOutputPixels,
  resolveSeedanceSeries,
  type SeedanceSeries,
} from "./seedance-output-pixels";
import {
  readVideoModelPricePromos,
  type VideoModelPricePromo,
} from "./video-price-promo";

export type {
  VideoModelPriceEstimateConfig,
  VideoModelPriceEstimateTier,
  VideoPriceEstimateResolution,
};
export { VIDEO_PRICE_ESTIMATE_RESOLUTIONS };

export const LANDING_VIDEO_PRICE_MODEL_ID = "doubao-seedance-2" as const;

export interface PublicVideoPriceEstimateTier {
  readonly resolution: string;
  readonly priceWithoutVideo: number;
  readonly priceWithVideo: number;
}

export interface PublicVideoPriceEstimateModel {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly tiers: readonly PublicVideoPriceEstimateTier[];
  readonly promos: readonly VideoModelPricePromo[];
  readonly maxReferenceVideos: number;
  readonly maxVideoReferenceSeconds: number;
  readonly maxVideoReferenceBytes: number;
  readonly maxOutputDurationSec: number;
}

export interface PublicVideoPriceEstimatesResponse {
  readonly models: readonly PublicVideoPriceEstimateModel[];
  readonly competitors: readonly VideoPriceCompetitor[];
  readonly scenarios: readonly HomepageVideoScenario[];
}

export const EMPTY_PUBLIC_VIDEO_PRICE_ESTIMATES: PublicVideoPriceEstimatesResponse =
  {
    models: [],
    competitors: [],
    scenarios: DEFAULT_HOMEPAGE_VIDEO_SCENARIOS,
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readPublicVideoPriceEstimateTier(
  value: unknown
): PublicVideoPriceEstimateTier | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.resolution !== "string") {
    return null;
  }
  if (
    typeof value.priceWithoutVideo !== "number" ||
    !Number.isFinite(value.priceWithoutVideo) ||
    typeof value.priceWithVideo !== "number" ||
    !Number.isFinite(value.priceWithVideo)
  ) {
    return null;
  }
  return {
    resolution: value.resolution,
    priceWithoutVideo: value.priceWithoutVideo,
    priceWithVideo: value.priceWithVideo,
  };
}

function readPublicVideoPriceEstimateModel(
  value: unknown
): PublicVideoPriceEstimateModel | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.canonicalId !== "string" ||
    typeof value.displayName !== "string" ||
    !Array.isArray(value.tiers)
  ) {
    return null;
  }
  const tiers = value.tiers.flatMap((entry) => {
    const tier = readPublicVideoPriceEstimateTier(entry);
    return tier ? [tier] : [];
  });
  if (tiers.length === 0) {
    return null;
  }
  return {
    canonicalId: value.canonicalId,
    displayName: value.displayName,
    tiers,
    promos: readVideoModelPricePromos(value.promos),
    maxReferenceVideos: readFiniteNumber(value.maxReferenceVideos, 0),
    maxVideoReferenceSeconds: readFiniteNumber(
      value.maxVideoReferenceSeconds,
      0
    ),
    maxVideoReferenceBytes: readFiniteNumber(value.maxVideoReferenceBytes, 0),
    maxOutputDurationSec: readFiniteNumber(
      value.maxOutputDurationSec,
      VIDEO_DURATION_MAX
    ),
  };
}

export function parsePublicVideoPriceEstimatesCache(
  value: string | null | undefined
): PublicVideoPriceEstimatesResponse {
  if (!value) {
    return EMPTY_PUBLIC_VIDEO_PRICE_ESTIMATES;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
      return EMPTY_PUBLIC_VIDEO_PRICE_ESTIMATES;
    }
    const models = Array.isArray(parsed.models)
      ? parsed.models.flatMap((entry) => {
          const model = readPublicVideoPriceEstimateModel(entry);
          return model ? [model] : [];
        })
      : [];
    return {
      models,
      competitors: readVideoPriceCompetitors(parsed.competitors),
      scenarios: readHomepageVideoScenarios(parsed.scenarios),
    };
  } catch {
    return EMPTY_PUBLIC_VIDEO_PRICE_ESTIMATES;
  }
}

export interface PublicVideoPriceEstimateSource {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly platformEnabled: boolean;
  readonly parameterRules: PlatformAiModelParameterRules;
}

export function toPublicVideoPriceEstimateModel(
  model: PublicVideoPriceEstimateSource
): PublicVideoPriceEstimateModel | null {
  if (!model.platformEnabled) {
    return null;
  }
  if (!isVideoModelParameterRules(model.parameterRules)) {
    return null;
  }

  const config = model.parameterRules.priceEstimate;
  if (config?.enabled !== true) {
    return null;
  }

  const tiers: PublicVideoPriceEstimateTier[] = [];
  for (const tier of config.tiers) {
    if (!tier.enabled) {
      continue;
    }
    if (
      !Number.isFinite(tier.priceWithoutVideo) ||
      !Number.isFinite(tier.priceWithVideo)
    ) {
      continue;
    }
    tiers.push({
      resolution: normalizeVideoPriceEstimateResolution(tier.resolution),
      priceWithoutVideo: tier.priceWithoutVideo,
      priceWithVideo: tier.priceWithVideo,
    });
  }

  if (tiers.length === 0) {
    return null;
  }

  return {
    canonicalId: model.canonicalId,
    displayName: model.displayName,
    tiers,
    promos: readVideoModelPricePromos(config.promos),
    maxReferenceVideos: model.parameterRules.maxReferenceVideos,
    maxVideoReferenceSeconds: model.parameterRules.maxVideoReferenceSeconds,
    maxVideoReferenceBytes: model.parameterRules.maxVideoReferenceBytes,
    maxOutputDurationSec: readVideoModelMaxOutputDurationSec(
      model.parameterRules
    ),
  };
}

export function readVideoModelMaxOutputDurationSec(
  rules: Pick<VideoModelParameterRules, "generationFields">
): number {
  const durationField = rules.generationFields.find(
    (field) => field.name === "duration"
  );
  const parsed = resolveDurationOptions(durationField)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 1);
  if (parsed.length === 0) {
    return VIDEO_DURATION_MAX;
  }
  return Math.max(...parsed);
}

export interface VideoClipPlan {
  readonly clipCount: number;
  readonly clipDurationSec: number;
  readonly lastClipDurationSec: number;
}

export function planVideoEstimateClips(params: {
  readonly totalDurationSec: number;
  readonly maxOutputDurationSec: number;
}): VideoClipPlan {
  const clipDurationSec = Math.max(1, params.maxOutputDurationSec);
  const totalDurationSec = Math.max(0, params.totalDurationSec);
  if (totalDurationSec <= 0) {
    return {
      clipCount: 1,
      clipDurationSec,
      lastClipDurationSec: clipDurationSec,
    };
  }
  const clipCount = Math.max(1, Math.ceil(totalDurationSec / clipDurationSec));
  const lastClipDurationSec =
    clipCount === 1
      ? totalDurationSec
      : totalDurationSec - (clipCount - 1) * clipDurationSec;
  return {
    clipCount,
    clipDurationSec,
    lastClipDurationSec,
  };
}

export function splitClipOutputSeconds(
  plan: VideoClipPlan,
  referencedCount: number
): {
  readonly referencedOutputSec: number;
  readonly plainOutputSec: number;
} {
  const used = Math.min(
    Math.max(0, Math.floor(referencedCount)),
    plan.clipCount
  );
  const totalOutputSec =
    (plan.clipCount - 1) * plan.clipDurationSec + plan.lastClipDurationSec;
  if (used <= 0) {
    return { referencedOutputSec: 0, plainOutputSec: totalOutputSec };
  }
  if (used >= plan.clipCount) {
    return { referencedOutputSec: totalOutputSec, plainOutputSec: 0 };
  }
  const referencedOutputSec = used * plan.clipDurationSec;
  return {
    referencedOutputSec,
    plainOutputSec: totalOutputSec - referencedOutputSec,
  };
}

export interface SplitVideoPriceEstimateResult {
  readonly costYuan: number;
  readonly billingTokens: number;
  readonly outputDurationSec: number;
}

export function computeSplitVideoPriceEstimateForModel(params: {
  readonly canonicalId: string;
  readonly resolution: string;
  readonly ratio: string;
  readonly priceWithoutVideo: number;
  readonly priceWithVideo: number;
  readonly plan: VideoClipPlan;
  readonly referencedCount: number;
  readonly avgReferenceSec: number;
}): SplitVideoPriceEstimateResult {
  const used = Math.min(
    Math.max(0, Math.floor(params.referencedCount)),
    params.plan.clipCount
  );
  const avgReferenceSec = Math.max(0, params.avgReferenceSec);
  const hasRef = used > 0 && avgReferenceSec > 0;
  const effectiveUsed = hasRef ? used : 0;
  const lastIsReferenced = effectiveUsed === params.plan.clipCount;
  const fullCount = params.plan.clipCount - 1;
  const fullReferencedCount = lastIsReferenced
    ? fullCount
    : Math.min(effectiveUsed, fullCount);
  const fullPlainCount = fullCount - fullReferencedCount;
  const base = {
    canonicalId: params.canonicalId,
    resolution: params.resolution,
    ratio: params.ratio,
    priceWithoutVideo: params.priceWithoutVideo,
    priceWithVideo: params.priceWithVideo,
  };

  let costYuan = 0;
  let billingTokens = 0;
  let outputDurationSec = 0;

  const addClips = (
    count: number,
    outputDurationSecOne: number,
    withReference: boolean
  ) => {
    if (count <= 0 || outputDurationSecOne <= 0) {
      return;
    }
    const one = computeVideoPriceEstimateForModel({
      ...base,
      outputDurationSec: outputDurationSecOne,
      inputDurationSec: withReference ? avgReferenceSec : 0,
      hasReferenceVideo: withReference,
    });
    costYuan += one.costYuan * count;
    billingTokens += one.billingTokens * count;
    outputDurationSec += one.outputDurationSec * count;
  };

  addClips(fullReferencedCount, params.plan.clipDurationSec, true);
  addClips(fullPlainCount, params.plan.clipDurationSec, false);
  addClips(1, params.plan.lastClipDurationSec, lastIsReferenced);

  return { costYuan, billingTokens, outputDurationSec };
}

export interface VideoPriceEstimateTierPrices {
  readonly priceWithoutVideo: number;
  readonly priceWithVideo: number;
}

export interface VideoPriceEstimateResult {
  readonly width: number;
  readonly height: number;
  readonly tps: number;
  readonly outputDurationSec: number;
  readonly inputDurationSec: number;
  readonly outputTokens: number;
  readonly inputTokens: number;
  readonly billingTokens: number;
  readonly unitPrice: number;
  readonly costYuan: number;
}

export function normalizeVideoPriceEstimateResolution(
  resolution: string
): string {
  return resolution.trim().toLowerCase();
}

export function createDefaultVideoPriceEstimateTiers(): readonly VideoModelPriceEstimateTier[] {
  return VIDEO_PRICE_ESTIMATE_RESOLUTIONS.map((resolution) => ({
    resolution,
    enabled: false,
    priceWithoutVideo: 0,
    priceWithVideo: 0,
  }));
}

export function isVideoPriceEstimateEnabled(
  rules: Pick<VideoModelParameterRules, "priceEstimate">
): boolean {
  return rules.priceEstimate?.enabled === true;
}

export function readVideoPriceEstimateTier(
  rules: Pick<VideoModelParameterRules, "priceEstimate">,
  resolution: string
): VideoPriceEstimateTierPrices | null {
  const config = rules.priceEstimate;
  if (config?.enabled !== true) {
    return null;
  }

  const key = normalizeVideoPriceEstimateResolution(resolution);
  const tier = config.tiers.find(
    (entry) =>
      normalizeVideoPriceEstimateResolution(entry.resolution) === key &&
      entry.enabled === true
  );
  if (!tier) {
    return null;
  }
  if (
    !Number.isFinite(tier.priceWithoutVideo) ||
    !Number.isFinite(tier.priceWithVideo)
  ) {
    return null;
  }

  return {
    priceWithoutVideo: tier.priceWithoutVideo,
    priceWithVideo: tier.priceWithVideo,
  };
}

export function readVideoPriceEstimateBaseline480pWithVideo(
  rules: Pick<VideoModelParameterRules, "priceEstimate">
): number | null {
  const tier = readVideoPriceEstimateTier(rules, "480p");
  if (!tier || tier.priceWithVideo <= 0) {
    return null;
  }
  return tier.priceWithVideo;
}

export function computePackTokens(params: {
  readonly billingTokens: number;
  readonly unitPrice: number;
  readonly baseline480pWithVideo: number;
}): number | null {
  if (
    !Number.isFinite(params.baseline480pWithVideo) ||
    params.baseline480pWithVideo <= 0
  ) {
    return null;
  }
  return (
    (params.unitPrice / params.baseline480pWithVideo) * params.billingTokens
  );
}

export function computeCostPerOutputSecond(
  costYuan: number,
  outputDurationSec: number
): number {
  if (outputDurationSec <= 0) {
    return 0;
  }
  return costYuan / outputDurationSec;
}

export function computeVideoTokensPerSecond(
  width: number,
  height: number
): number {
  return (width * height * 24) / 1024;
}

export function computeVideoOutputTokens(
  outputDurationSec: number,
  tps: number
): number {
  return Math.round(outputDurationSec * tps);
}

export function computeVideoBillingTokens(params: {
  readonly outputDurationSec: number;
  readonly inputDurationSec: number;
  readonly hasReferenceVideo: boolean;
  readonly tps: number;
}): number {
  const { outputDurationSec, inputDurationSec, hasReferenceVideo, tps } =
    params;

  if (!hasReferenceVideo || inputDurationSec <= 0) {
    return Math.round(outputDurationSec * tps);
  }

  const minDuration = Math.ceil(outputDurationSec * (5 / 3));
  const billingDuration = Math.max(
    inputDurationSec + outputDurationSec,
    minDuration
  );
  return Math.round(billingDuration * tps);
}

export function computeVideoPriceEstimate(params: {
  readonly series: SeedanceSeries;
  readonly resolution: string;
  readonly ratio: string;
  readonly outputDurationSec: number;
  readonly inputDurationSec: number;
  readonly hasReferenceVideo: boolean;
  readonly priceWithoutVideo: number;
  readonly priceWithVideo: number;
}): VideoPriceEstimateResult {
  const pixels = getSeedanceOutputPixels(
    params.series,
    params.resolution,
    params.ratio
  );
  const tps = computeVideoTokensPerSecond(pixels.width, pixels.height);
  const outputTokens = computeVideoOutputTokens(params.outputDurationSec, tps);
  const inputTokens =
    params.hasReferenceVideo && params.inputDurationSec > 0
      ? Math.round(params.inputDurationSec * tps)
      : 0;
  const billingTokens = computeVideoBillingTokens({
    outputDurationSec: params.outputDurationSec,
    inputDurationSec: params.inputDurationSec,
    hasReferenceVideo: params.hasReferenceVideo,
    tps,
  });
  const unitPrice = params.hasReferenceVideo
    ? params.priceWithVideo
    : params.priceWithoutVideo;
  const costYuan = (billingTokens / 1_000_000) * unitPrice;

  return {
    width: pixels.width,
    height: pixels.height,
    tps,
    outputDurationSec: params.outputDurationSec,
    inputDurationSec: params.inputDurationSec,
    outputTokens,
    inputTokens,
    billingTokens,
    unitPrice,
    costYuan,
  };
}

export function computeVideoPriceEstimateForModel(params: {
  readonly canonicalId: string;
  readonly resolution: string;
  readonly ratio: string;
  readonly outputDurationSec: number;
  readonly inputDurationSec: number;
  readonly hasReferenceVideo: boolean;
  readonly priceWithoutVideo: number;
  readonly priceWithVideo: number;
}): VideoPriceEstimateResult {
  return computeVideoPriceEstimate({
    series: resolveSeedanceSeries(params.canonicalId),
    resolution: params.resolution,
    ratio: params.ratio,
    outputDurationSec: params.outputDurationSec,
    inputDurationSec: params.inputDurationSec,
    hasReferenceVideo: params.hasReferenceVideo,
    priceWithoutVideo: params.priceWithoutVideo,
    priceWithVideo: params.priceWithVideo,
  });
}

export function formatVideoPriceEstimateParts(
  costYuan: number,
  billingTokens: number
): { readonly cost: string; readonly megaTokens: string } {
  return {
    cost: costYuan.toFixed(1),
    megaTokens: (billingTokens / 1_000_000).toFixed(1),
  };
}

export function formatVideoPriceEstimateSummary(
  costYuan: number,
  billingTokens: number
): string {
  const { cost, megaTokens } = formatVideoPriceEstimateParts(
    costYuan,
    billingTokens
  );
  return `约${cost}￥~${megaTokens}M`;
}

export function formatVideoTokenMillions(tokens: number): string {
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}
