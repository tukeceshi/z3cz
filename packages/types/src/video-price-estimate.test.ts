import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
  VIDEO_DURATION_MAX,
} from "./platform-ai-model";
import {
  computeCostPerOutputSecond,
  computePackTokens,
  computeSplitVideoPriceEstimateForModel,
  computeVideoBillingTokens,
  computeVideoPriceEstimateForModel,
  applyVideoPriceEstimateDisplayFolds,
  EMPTY_PUBLIC_VIDEO_PRICE_ESTIMATES,
  formatVideoBillingTokensDisplay,
  formatVideoPriceEstimateSummary,
  isVideoPriceEstimateEnabled,
  parsePublicVideoPriceEstimatesCache,
  planVideoEstimateClips,
  readVideoPriceEstimateBaseline480pWithoutVideo,
  readVideoPriceEstimateDisplayFolds,
  readVideoPriceEstimateTier,
  splitClipOutputSeconds,
  toPublicVideoPriceEstimateModel,
} from "./video-price-estimate";

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
    expect(result.costYuan).toBeCloseTo(
      (result.billingTokens / 1_000_000) * 1.44
    );
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

describe("applyVideoPriceEstimateDisplayFolds", () => {
  it("stacks folds as successive discounts", () => {
    expect(applyVideoPriceEstimateDisplayFolds(10, [8, 8])).toBe(6.4);
  });

  it("returns the original value when there are no folds", () => {
    expect(applyVideoPriceEstimateDisplayFolds(10, [])).toBe(10);
  });

  it("changes cost without affecting computed tokens", () => {
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
    const folded = applyVideoPriceEstimateDisplayFolds(result.costYuan, [8]);
    expect(folded).toBeCloseTo(result.costYuan * 0.8);
    expect(result.billingTokens).toBe(Math.round(5 * result.tps));
  });
});

describe("readVideoPriceEstimateDisplayFolds", () => {
  it("applies an active promo then the org fold", () => {
    expect(
      readVideoPriceEstimateDisplayFolds({
        promos: [
          {
            id: "a",
            resolution: "any",
            startsAt: "2026-08-01",
            endsAt: "2026-08-31",
            discountFold: 8,
          },
        ],
        orgDiscountFold: 8,
        resolution: "720p",
        now: new Date(2026, 7, 17),
      })
    ).toEqual([8, 8]);
  });

  it("omits official promo when applyOfficialDiscount is false", () => {
    expect(
      readVideoPriceEstimateDisplayFolds({
        promos: [
          {
            id: "a",
            resolution: "any",
            startsAt: "2026-08-01",
            endsAt: "2026-08-31",
            discountFold: 8,
          },
        ],
        orgDiscountFold: 8,
        applyOfficialDiscount: false,
        resolution: "720p",
        now: new Date(2026, 7, 17),
      })
    ).toEqual([8]);
  });

  it("omits inactive promos and invalid org folds", () => {
    expect(
      readVideoPriceEstimateDisplayFolds({
        promos: [
          {
            id: "a",
            resolution: "720p",
            startsAt: "2026-09-01",
            endsAt: "2026-09-30",
            discountFold: 8,
          },
        ],
        orgDiscountFold: 11,
        resolution: "720p",
        now: new Date(2026, 7, 17),
      })
    ).toEqual([]);
  });
});

describe("computePackTokens", () => {
  it("scales billing tokens by unit price ratio to 480p without-video baseline", () => {
    expect(
      computePackTokens({
        billingTokens: 100_000,
        unitPrice: 2.88,
        baseline480pWithoutVideo: 1.44,
      })
    ).toBe(200_000);
  });

  it("equals billing tokens at 480p without reference video", () => {
    expect(
      computePackTokens({
        billingTokens: 50_222,
        unitPrice: 46,
        baseline480pWithoutVideo: 46,
      })
    ).toBe(50_222);
  });

  it("scales down with-video unit price against without-video baseline", () => {
    expect(
      computePackTokens({
        billingTokens: 100_000,
        unitPrice: 28,
        baseline480pWithoutVideo: 46,
      })
    ).toBeCloseTo(60_869.565, 2);
  });

  it("returns null when baseline is missing", () => {
    expect(
      computePackTokens({
        billingTokens: 100_000,
        unitPrice: 2.88,
        baseline480pWithoutVideo: 0,
      })
    ).toBeNull();
  });
});

describe("computeCostPerOutputSecond", () => {
  it("divides cost by output seconds", () => {
    expect(computeCostPerOutputSecond(4.5, 5)).toBeCloseTo(0.9);
  });
});

describe("readVideoPriceEstimateBaseline480pWithoutVideo", () => {
  it("reads enabled 480p without-video price", () => {
    expect(
      readVideoPriceEstimateBaseline480pWithoutVideo({
        priceEstimate: {
          enabled: true,
          tiers: [
            {
              resolution: "480p",
              enabled: true,
              priceWithoutVideo: 46,
              priceWithVideo: 28,
            },
          ],
        },
      })
    ).toBe(46);
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

describe("formatVideoBillingTokensDisplay", () => {
  it("formats sub-thousand tokens with token suffix", () => {
    expect(formatVideoBillingTokensDisplay(555)).toBe("555 token");
    expect(formatVideoBillingTokensDisplay(999)).toBe("999 token");
    expect(formatVideoBillingTokensDisplay(0)).toBe("0 token");
  });

  it("formats sub-million tokens with K suffix", () => {
    expect(formatVideoBillingTokensDisplay(1000)).toBe("1 K");
    expect(formatVideoBillingTokensDisplay(128_000)).toBe("128 K");
    expect(formatVideoBillingTokensDisplay(555_250)).toBe("555.25 K");
  });

  it("formats million-plus tokens with M suffix", () => {
    expect(formatVideoBillingTokensDisplay(1_000_000)).toBe("1M");
    expect(formatVideoBillingTokensDisplay(1_250_000)).toBe("1.25M");
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
      promos: [],
      maxReferenceVideos:
        DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxReferenceVideos,
      maxVideoReferenceSeconds:
        DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceSeconds,
      maxVideoReferenceBytes:
        DEFAULT_VIDEO_MODEL_PARAMETER_RULES.maxVideoReferenceBytes,
      maxOutputDurationSec: VIDEO_DURATION_MAX,
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

describe("planVideoEstimateClips", () => {
  it("splits total duration into max-length clips", () => {
    expect(
      planVideoEstimateClips({
        totalDurationSec: 150,
        maxOutputDurationSec: 15,
      })
    ).toEqual({
      clipCount: 10,
      clipDurationSec: 15,
      lastClipDurationSec: 15,
    });
  });

  it("puts the remainder on the last clip", () => {
    expect(
      planVideoEstimateClips({
        totalDurationSec: 16,
        maxOutputDurationSec: 15,
      })
    ).toEqual({
      clipCount: 2,
      clipDurationSec: 15,
      lastClipDurationSec: 1,
    });
  });
});

describe("splitClipOutputSeconds", () => {
  const plan = {
    clipCount: 10,
    clipDurationSec: 15,
    lastClipDurationSec: 15,
  };

  it("splits referenced clips from the front", () => {
    expect(splitClipOutputSeconds(plan, 5)).toEqual({
      referencedOutputSec: 75,
      plainOutputSec: 75,
    });
  });

  it("treats zero referenced clips as all plain", () => {
    expect(splitClipOutputSeconds(plan, 0)).toEqual({
      referencedOutputSec: 0,
      plainOutputSec: 150,
    });
  });
});

describe("computeSplitVideoPriceEstimateForModel", () => {
  const prices = {
    canonicalId: "doubao-seedance-2-5",
    resolution: "720p",
    ratio: "16:9",
    priceWithoutVideo: 1.44,
    priceWithVideo: 2.88,
  };

  it("adds per-clip with-reference cost times count plus unused clips", () => {
    const plan = planVideoEstimateClips({
      totalDurationSec: 150,
      maxOutputDurationSec: 15,
    });
    const withRef = computeVideoPriceEstimateForModel({
      ...prices,
      outputDurationSec: 15,
      inputDurationSec: 10,
      hasReferenceVideo: true,
    });
    const withoutRef = computeVideoPriceEstimateForModel({
      ...prices,
      outputDurationSec: 15,
      inputDurationSec: 0,
      hasReferenceVideo: false,
    });
    const split = computeSplitVideoPriceEstimateForModel({
      ...prices,
      plan,
      referencedCount: 5,
      avgReferenceSec: 10,
    });

    expect(split.costYuan).toBeCloseTo(
      withRef.costYuan * 5 + withoutRef.costYuan * 5
    );
    expect(split.billingTokens).toBe(
      withRef.billingTokens * 5 + withoutRef.billingTokens * 5
    );
    expect(split.outputDurationSec).toBe(150);
  });
});

describe("parsePublicVideoPriceEstimatesCache", () => {
  it("returns empty when the cache is missing", () => {
    expect(parsePublicVideoPriceEstimatesCache(null)).toEqual(
      EMPTY_PUBLIC_VIDEO_PRICE_ESTIMATES
    );
  });

  it("does not invent default competitors", () => {
    expect(
      parsePublicVideoPriceEstimatesCache(
        JSON.stringify({ models: [], competitors: [] })
      )
    ).toEqual(EMPTY_PUBLIC_VIDEO_PRICE_ESTIMATES);
  });

  it("reads a snapshot payload", () => {
    const parsed = parsePublicVideoPriceEstimatesCache(
      JSON.stringify({
        models: [
          {
            canonicalId: "doubao-seedance-2",
            displayName: "Seedance 2.0",
            tiers: [
              {
                resolution: "720p",
                priceWithoutVideo: 46,
                priceWithVideo: 28,
              },
            ],
            promos: [],
            maxReferenceVideos: 3,
            maxVideoReferenceSeconds: 60,
            maxVideoReferenceBytes: 1,
            maxOutputDurationSec: 15,
          },
        ],
        competitors: [{ id: "libtv", name: "LibTV", config: {} }],
      })
    );
    expect(parsed.models).toHaveLength(1);
    expect(parsed.models[0]?.canonicalId).toBe("doubao-seedance-2");
    expect(parsed.competitors).toHaveLength(1);
    expect(parsed.competitors[0]?.id).toBe("libtv");
    expect(parsed.competitors[0]?.kind).toBe("compare");
  });

  it("reads promo notes from the snapshot", () => {
    const parsed = parsePublicVideoPriceEstimatesCache(
      JSON.stringify({
        models: [],
        competitors: [
          {
            id: "note-1",
            name: "Other",
            kind: "promoNote",
            text: "8 折",
            showDates: false,
            startsAt: "",
            endsAt: "",
          },
        ],
      })
    );
    expect(parsed.competitors).toEqual([
      {
        id: "note-1",
        name: "Other",
        kind: "promoNote",
        showUrl: false,
        url: "",
        text: "8 折",
        showDates: false,
        startsAt: "",
        endsAt: "",
      },
    ]);
  });
});
