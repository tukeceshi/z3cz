import { describe, expect, it } from "vitest";

import {
  DEFAULT_LIBTV_COMPARISON_CONFIG,
  computeLibtvConvertedYuan,
  computeLibtvCredits,
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
});

describe("computeLibtvConvertedYuan", () => {
  it("converts standard monthly credits to yuan", () => {
    const plan = DEFAULT_LIBTV_COMPARISON_CONFIG.plans[0];
    expect(computeLibtvConvertedYuan(1500, plan)).toBeCloseTo(59);
  });
});

describe("mergeLibtvComparisonConfig", () => {
  it("keeps defaults when payload is empty", () => {
    const merged = mergeLibtvComparisonConfig({});
    expect(merged.plans[0]?.credits).toBe(1500);
    expect(merged.series["2.0"].resolutions["480p"]?.withoutReferencePerSec).toBe(
      13
    );
  });

  it("overrides a single rate", () => {
    const merged = mergeLibtvComparisonConfig({
      series: {
        "2.0": {
          resolutions: {
            "480p": { withoutReferencePerSec: 15, withReferencePerSec: 22 },
          },
        },
      },
    });
    expect(merged.series["2.0"].resolutions["480p"]?.withoutReferencePerSec).toBe(
      15
    );
    expect(merged.series["2.0"].resolutions["1080p"]?.withoutReferencePerSec).toBe(
      68
    );
  });
});
