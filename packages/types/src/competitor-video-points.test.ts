import { describe, expect, it } from "vitest";

import {
  computeLibtvConvertedYuan,
  computeLibtvCredits,
  computeLibtvCreditsForClipSplit,
  computePlanAccountCount,
  DEFAULT_LIBTV_COMPARISON_CONFIG,
  matchLowestCoveringPlan,
  mergeLibtvComparisonConfig,
} from "./competitor-video-points";

describe("computeLibtvCredits", () => {
  it("uses 2.0 without-reference rate on output seconds only", () => {
    expect(
      computeLibtvCredits({
        config: DEFAULT_LIBTV_COMPARISON_CONFIG,
        canonicalId: "doubao-seedance-2",
        resolution: "1080p",
        outputDurationSec: 5,
        referenceDurationSec: 0,
      })
    ).toBe(340);
  });

  it("uses 2.0 with-reference rate and ignores reference duration", () => {
    expect(
      computeLibtvCredits({
        config: DEFAULT_LIBTV_COMPARISON_CONFIG,
        canonicalId: "doubao-seedance-2",
        resolution: "1080p",
        outputDurationSec: 5,
        referenceDurationSec: 12,
      })
    ).toBe(550);
  });

  it("adds reference seconds at the same 2.5 rate", () => {
    expect(
      computeLibtvCredits({
        config: DEFAULT_LIBTV_COMPARISON_CONFIG,
        canonicalId: "doubao-seedance-2-5",
        resolution: "720p",
        outputDurationSec: 5,
        referenceDurationSec: 3,
      })
    ).toBe(368);
  });

  it("uses Fast rates separately from 2.0", () => {
    const config = mergeLibtvComparisonConfig({
      series: {
        "doubao-seedance-2-fast": {
          resolutions: {
            "1080p": { withoutReferencePerSec: 10, withReferencePerSec: 12 },
          },
        },
      },
    });
    expect(
      computeLibtvCredits({
        config,
        canonicalId: "doubao-seedance-2-fast",
        resolution: "1080p",
        outputDurationSec: 5,
        referenceDurationSec: 0,
      })
    ).toBe(50);
    expect(
      computeLibtvCredits({
        config,
        canonicalId: "doubao-seedance-2",
        resolution: "1080p",
        outputDurationSec: 5,
        referenceDurationSec: 0,
      })
    ).toBe(340);
  });

  it("returns null for 2.5 4k when no rate is configured", () => {
    expect(
      computeLibtvCredits({
        config: DEFAULT_LIBTV_COMPARISON_CONFIG,
        canonicalId: "doubao-seedance-2-5",
        resolution: "4k",
        outputDurationSec: 5,
        referenceDurationSec: 0,
      })
    ).toBeNull();
  });

  it("uses distinct Fast and Mini default rates", () => {
    expect(
      computeLibtvCredits({
        config: DEFAULT_LIBTV_COMPARISON_CONFIG,
        canonicalId: "doubao-seedance-2-fast",
        resolution: "480p",
        outputDurationSec: 5,
        referenceDurationSec: 0,
      })
    ).toBe(50);
    expect(
      computeLibtvCredits({
        config: DEFAULT_LIBTV_COMPARISON_CONFIG,
        canonicalId: "doubao-seedance-2-mini",
        resolution: "480p",
        outputDurationSec: 5,
        referenceDurationSec: 0,
      })
    ).toBe(40);
    expect(
      DEFAULT_LIBTV_COMPARISON_CONFIG.series["doubao-seedance-2-fast"]
        .resolutions["1080p"]
    ).toBeUndefined();
  });
});

describe("computeLibtvCreditsForClipSplit", () => {
  it("splits 2.0 with-reference rate onto referenced output only", () => {
    const split = computeLibtvCreditsForClipSplit({
      config: DEFAULT_LIBTV_COMPARISON_CONFIG,
      canonicalId: "doubao-seedance-2",
      resolution: "1080p",
      referencedOutputSec: 75,
      plainOutputSec: 75,
      referenceDurationSec: 50,
    });
    expect(split).toEqual({
      referencedCredits: 8250,
      plainCredits: 5100,
    });
  });

  it("adds 2.5 reference seconds on the referenced part only", () => {
    const split = computeLibtvCreditsForClipSplit({
      config: DEFAULT_LIBTV_COMPARISON_CONFIG,
      canonicalId: "doubao-seedance-2-5",
      resolution: "720p",
      referencedOutputSec: 75,
      plainOutputSec: 75,
      referenceDurationSec: 50,
    });
    expect(split).toEqual({
      referencedCredits: 5750,
      plainCredits: 3450,
    });
  });
});

describe("computeLibtvConvertedYuan", () => {
  it("converts standard monthly credits to yuan", () => {
    const plan = DEFAULT_LIBTV_COMPARISON_CONFIG.plans[0];
    expect(computeLibtvConvertedYuan(1500, plan)).toBeCloseTo(59);
  });
});

describe("matchLowestCoveringPlan", () => {
  const plans = [
    { id: "a", credits: 1500 },
    { id: "b", credits: 8000 },
    { id: "c", credits: 66000 },
  ];

  it("picks the lowest plan that covers the needed credits", () => {
    expect(matchLowestCoveringPlan(plans, 405)?.id).toBe("a");
    expect(matchLowestCoveringPlan(plans, 1501)?.id).toBe("b");
    expect(matchLowestCoveringPlan(plans, 8000)?.id).toBe("b");
  });

  it("picks the highest plan when none covers the needed credits", () => {
    expect(matchLowestCoveringPlan(plans, 100_000)?.id).toBe("c");
  });
});

describe("computePlanAccountCount", () => {
  it("returns 1 when one plan covers the needed credits", () => {
    expect(computePlanAccountCount(405, 1500)).toBe(1);
    expect(computePlanAccountCount(1500, 1500)).toBe(1);
  });

  it("rounds up for the selected plan, including lower tiers", () => {
    expect(computePlanAccountCount(1501, 1500)).toBe(2);
    expect(computePlanAccountCount(145_800, 66_000)).toBe(3);
    expect(computePlanAccountCount(145_800, 1500)).toBe(98);
  });
});

describe("mergeLibtvComparisonConfig", () => {
  it("keeps defaults when payload is empty", () => {
    const merged = mergeLibtvComparisonConfig({});
    expect(DEFAULT_LIBTV_COMPARISON_CONFIG.plans).toHaveLength(7);
    expect(DEFAULT_LIBTV_COMPARISON_CONFIG.promos).toHaveLength(3);
    expect(merged.plans).toEqual(DEFAULT_LIBTV_COMPARISON_CONFIG.plans);
    expect(
      merged.series["doubao-seedance-2"].resolutions["480p"]
        ?.withoutReferencePerSec
    ).toBe(13);
  });

  it("overrides a single rate", () => {
    const merged = mergeLibtvComparisonConfig({
      series: {
        "doubao-seedance-2": {
          resolutions: {
            "480p": { withoutReferencePerSec: 15, withReferencePerSec: 22 },
          },
        },
      },
    });
    expect(
      merged.series["doubao-seedance-2"].resolutions["480p"]
        ?.withoutReferencePerSec
    ).toBe(15);
    expect(
      merged.series["doubao-seedance-2"].resolutions["1080p"]
    ).toBeUndefined();
  });

  it("keeps omitted resolutions empty instead of filling defaults", () => {
    const merged = mergeLibtvComparisonConfig({
      series: {
        "doubao-seedance-2-5": {
          addReferenceSecondsToOutput: true,
          resolutions: {
            "720p": { withoutReferencePerSec: 46, withReferencePerSec: null },
          },
        },
      },
    });
    expect(
      merged.series["doubao-seedance-2-5"].resolutions["720p"]
        ?.withoutReferencePerSec
    ).toBe(46);
    expect(
      merged.series["doubao-seedance-2-5"].resolutions["4k"]
    ).toBeUndefined();
    expect(
      merged.series["doubao-seedance-2-5"].resolutions["480p"]
    ).toBeUndefined();
  });

  it("keeps a custom plan list instead of a fixed pair", () => {
    const merged = mergeLibtvComparisonConfig({
      plans: [
        { id: "starter", name: "入门", credits: 800, priceYuan: 29 },
        { id: "pro", name: "专业", credits: 8000, priceYuan: 199 },
        { id: "studio", name: "工作室", credits: 30000, priceYuan: 699 },
      ],
    });
    expect(merged.plans).toEqual([
      { id: "starter", name: "入门", credits: 800, priceYuan: 29 },
      { id: "pro", name: "专业", credits: 8000, priceYuan: 199 },
      { id: "studio", name: "工作室", credits: 30000, priceYuan: 699 },
    ]);
  });

  it("fills legacy plan names when name is missing", () => {
    const merged = mergeLibtvComparisonConfig({
      plans: [{ id: "standard-monthly", credits: 2000, priceYuan: 79 }],
    });
    expect(merged.plans).toEqual([
      { id: "standard-monthly", name: "标准", credits: 2000, priceYuan: 79 },
    ]);
  });

  it("maps legacy 2.0 / 2.5 keys", () => {
    const merged = mergeLibtvComparisonConfig({
      series: {
        "2.0": {
          resolutions: {
            "480p": { withoutReferencePerSec: 14, withReferencePerSec: 21 },
          },
        },
        "2.5": {
          addReferenceSecondsToOutput: true,
          resolutions: {
            "720p": { withoutReferencePerSec: 50, withReferencePerSec: null },
          },
        },
      },
    });
    expect(
      merged.series["doubao-seedance-2"].resolutions["480p"]
        ?.withoutReferencePerSec
    ).toBe(14);
    expect(
      merged.series["doubao-seedance-2-5"].resolutions["720p"]
        ?.withoutReferencePerSec
    ).toBe(50);
  });

  it("reads saved promos", () => {
    const merged = mergeLibtvComparisonConfig({
      promos: [
        {
          id: "p1",
          canonicalId: "doubao-seedance-2",
          resolution: "720p",
          withReference: false,
          startsAt: "2026-08-01",
          endsAt: "2026-08-31",
          discountFold: 8,
        },
      ],
    });
    expect(merged.promos).toEqual([
      {
        id: "p1",
        canonicalId: "doubao-seedance-2",
        resolution: "720p",
        withReference: false,
        startsAt: "2026-08-01",
        endsAt: "2026-08-31",
        discountFold: 8,
      },
    ]);
  });

  it("copies saved 2.0 rates onto Fast and Mini when they are missing", () => {
    const merged = mergeLibtvComparisonConfig({
      series: {
        "doubao-seedance-2": {
          resolutions: {
            "480p": { withoutReferencePerSec: 99, withReferencePerSec: 100 },
          },
        },
      },
    });
    expect(
      merged.series["doubao-seedance-2-fast"].resolutions["480p"]
        ?.withoutReferencePerSec
    ).toBe(99);
    expect(
      merged.series["doubao-seedance-2-mini"].resolutions["480p"]
        ?.withoutReferencePerSec
    ).toBe(99);
  });
});
