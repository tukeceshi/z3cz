import {
  getSeedanceOutputPixels,
  resolveSeedanceSeries,
  type SeedanceSeries,
} from "./seedance-output-pixels";
import type { LibtvComparisonConfig } from "./competitor-video-points";
import type {
  PlatformAiModelParameterRules,
  VideoModelParameterRules,
  VideoModelPriceEstimateConfig,
  VideoModelPriceEstimateTier,
  VideoPriceEstimateResolution,
} from "./platform-ai-model";
import {
  VIDEO_PRICE_ESTIMATE_RESOLUTIONS,
  isVideoModelParameterRules,
} from "./platform-ai-model";

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
  readonly maxReferenceVideos: number;
  readonly maxVideoReferenceSeconds: number;
  readonly maxVideoReferenceBytes: number;
}

export interface PublicVideoPriceEstimatesResponse {
  readonly models: readonly PublicVideoPriceEstimateModel[];
  readonly libtv: LibtvComparisonConfig;
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
    maxReferenceVideos: model.parameterRules.maxReferenceVideos,
    maxVideoReferenceSeconds: model.parameterRules.maxVideoReferenceSeconds,
    maxVideoReferenceBytes: model.parameterRules.maxVideoReferenceBytes,
  };
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

export function normalizeVideoPriceEstimateResolution(resolution: string): string {
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
  return (params.unitPrice / params.baseline480pWithVideo) * params.billingTokens;
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
