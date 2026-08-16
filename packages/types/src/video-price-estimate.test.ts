import { DEFAULT_VIDEO_MODEL_PARAMETER_RULES } from "./platform-ai-model";
import {
  computeCostPerOutputSecond,
  computePackTokens,
  computeVideoBillingTokens,
  computeVideoPriceEstimateForModel,
  formatVideoPriceEstimateSummary,
  isVideoPriceEstimateEnabled,
  readVideoPriceEstimateBaseline480pWithVideo,
  readVideoPriceEstimateTier,
  toPublicVideoPriceEstimateModel,
} from "./video-price-estimate";
import { describe, expect, it } from "vitest";

describe("computeVideoBillingTokens", () => {
  it("rounds output-only tokens", () => {
    expect(
      computeVideoBillingTokens({
        outputDurationSec: 5,
        inputDurationSec: 0,
        hasReferenceVideo: false,
        tps: 100,
      })
    ).toBe(500);
  });

  it("applies reference-video floor with half-up rounding", () => {
    expect(
      computeVideoBillingTokens({
        outputDurationSec: 5,
        inputDurationSec: 3,
        hasReferenceVideo: true,
        tps: 100,
      })
    ).toBe(900);
  });
});

describe("computeVideoPriceEstimateForModel", () => {
  it("computes cost from billing tokens and unit price", () => {
    const result = computeVideoPriceEstimateForModel({
      canonicalId: "doubao-seedance-2-5",
      resolution: "720p",
      ratio: "16:9",
      outputDurationSec: 5,
      inputDurationSec: 0,
      hasReferenceVideo: false,
      priceWithoutVideo: 1.44,
      priceWithVideo: 2.88,
    });

    expect(result.billingTokens).toBe(Math.round(5 * result.tps));
    expect(result.costYuan).toBeCloseTo((result.billingTokens / 1_000_000) * 1.44);
    expect(result.unitPrice).toBe(1.44);
  });

  it("uses with-video unit price when reference video is present", () => {
    const result = computeVideoPriceEstimateForModel({
      canonicalId: "doubao-seedance-2-5",
      resolution: "720p",
      ratio: "16:9",
      outputDurationSec: 5,
      inputDurationSec: 3,
      hasReferenceVideo: true,
      priceWithoutVideo: 1.44,
      priceWithVideo: 2.88,
    });

    expect(result.unitPrice).toBe(2.88);
  });
});

describe("computePackTokens", () => {
  it("scales billing tokens by unit price ratio to 480p baseline", () => {
    expect(
      computePackTokens({
        billingTokens: 100_000,
        unitPrice: 2.88,
        baseline480pWithVideo: 1.44,
      })
    ).toBe(200_000);
  });

  it("returns null when baseline is missing", () => {
    expect(
      computePackTokens({
        billingTokens: 100_000,
        unitPrice: 2.88,
        baseline480pWithVideo: 0,
      })
    ).toBeNull();
  });
});

describe("computeCostPerOutputSecond", () => {
  it("divides cost by output seconds", () => {
    expect(computeCostPerOutputSecond(4.5, 5)).toBeCloseTo(0.9);
  });
});

describe("readVideoPriceEstimateBaseline480pWithVideo", () => {
  it("reads enabled 480p with-video price", () => {
    expect(
      readVideoPriceEstimateBaseline480pWithVideo({
        priceEstimate: {
          enabled: true,
          tiers: [
            {
              resolution: "480p",
              enabled: true,
              priceWithoutVideo: 1,
              priceWithVideo: 1.44,
            },
          ],
        },
      })
    ).toBe(1.44);
  });
});

describe("readVideoPriceEstimateTier", () => {
  it("returns enabled tier for matching resolution", () => {
    expect(
      readVideoPriceEstimateTier(
        {
          priceEstimate: {
            enabled: true,
            tiers: [
              {
                resolution: "720p",
                enabled: true,
                priceWithoutVideo: 1.44,
                priceWithVideo: 2.88,
              },
            ],
          },
        },
        "720p"
      )
    ).toEqual({
      priceWithoutVideo: 1.44,
      priceWithVideo: 2.88,
    });
  });

  it("returns null when tier is disabled or missing", () => {
    expect(
      readVideoPriceEstimateTier(
        {
          priceEstimate: {
            enabled: true,
            tiers: [
              {
                resolution: "720p",
                enabled: false,
                priceWithoutVideo: 1.44,
                priceWithVideo: 2.88,
              },
            ],
          },
        },
        "720p"
      )
    ).toBeNull();
  });
});

describe("isVideoPriceEstimateEnabled", () => {
  it("requires global enabled flag", () => {
    expect(
      isVideoPriceEstimateEnabled({
        priceEstimate: {
          enabled: true,
          tiers: [],
        },
      })
    ).toBe(true);
    expect(
      isVideoPriceEstimateEnabled({
        priceEstimate: {
          enabled: false,
          tiers: [],
        },
      })
    ).toBe(false);
  });
});

describe("formatVideoPriceEstimateSummary", () => {
  it("formats one-decimal cost and mega tokens with yen symbol", () => {
    expect(formatVideoPriceEstimateSummary(5.04, 128_000)).toBe("约5.0￥~0.1M");
    expect(formatVideoPriceEstimateSummary(1.44, 320_000)).toBe("约1.4￥~0.3M");
  });
});

describe("toPublicVideoPriceEstimateModel", () => {
  it("returns enabled tiers only", () => {
    const result = toPublicVideoPriceEstimateModel({
      canonicalId: "doubao-seedance-2",
      displayName: "Seedance 2.0",
      platformEnabled: true,
      parameterRules: {
        ...DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
        priceEstimate: {
          enabled: true,
          tiers: [
            {
              resolution: "720p",
              enabled: true,
              priceWithoutVideo: 46,
              priceWithVideo: 28,
            },
            {
              resolution: "4k",
              enabled: false,
              priceWithoutVideo: 90,
              priceWithVideo: 50,
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      canonicalId: "doubao-seedance-2",
      displayName: "Seedance 2.0",
      tiers: [
        {
          resolution: "720p",
          priceWithoutVideo: 46,
          priceWithVideo: 28,
        },
      ],
      maxReferenceVideos: DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceVideos,
      maxVideoReferenceSeconds:
        DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceSeconds,
      maxVideoReferenceBytes:
        DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceBytes,
    });
  });

  it("returns null when estimate is off", () => {
    expect(
      toPublicVideoPriceEstimateModel({
        canonicalId: "doubao-seedance-2",
        displayName: "Seedance 2.0",
        platformEnabled: true,
        parameterRules: DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
      })
    ).toBeNull();
  });
});
