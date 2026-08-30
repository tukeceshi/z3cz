import { describe, expect, it } from "vitest";
import {
  getSeedanceDefaultParameterRules,
  isSeedance25PlatformModel,
  SEEDANCE_25_PLATFORM_CANONICAL_IDS,
  SEEDANCE_PLATFORM_MODEL_DEFAULTS,
} from "./seedance-model-defaults";
import { SEEDANCE_CANONICAL_IDS } from "./single-model-interface-metadata";

describe("SEEDANCE_PLATFORM_MODEL_DEFAULTS", () => {
  it("covers all Seedance models with price estimates on", () => {
    for (const canonicalId of SEEDANCE_CANONICAL_IDS) {
      const rules =
        SEEDANCE_PLATFORM_MODEL_DEFAULTS[canonicalId].parameterRules;
      expect(rules.priceEstimate?.enabled).toBe(true);
      expect(rules.priceEstimate?.tiers.length).toBeGreaterThan(0);
    }
  });

  it("keeps current 2.0 prices and reference limits", () => {
    const rules = getSeedanceDefaultParameterRules("doubao-seedance-2");
    expect(rules?.maxReferenceImages).toBe(9);
    expect(rules?.maxReferenceVideos).toBe(3);
    expect(
      rules?.priceEstimate?.tiers.find((tier) => tier.resolution === "720p")
    ).toEqual({
      resolution: "720p",
      enabled: true,
      priceWithoutVideo: 46,
      priceWithVideo: 28,
    });
  });

  it("keeps Fast default resolution at 480p", () => {
    const rules = getSeedanceDefaultParameterRules("doubao-seedance-2-fast");
    const resolution = rules?.generationFields.find(
      (field) => field.name === "resolution"
    );
    expect(resolution?.default).toBe("480p");
    expect(resolution?.enumValues).toEqual(["480p", "720p"]);
  });

  it("keeps 2.5 higher reference limits and 1080p promo", () => {
    const rules = getSeedanceDefaultParameterRules("doubao-seedance-2-5");
    expect(rules?.maxReferenceImages).toBe(30);
    expect(rules?.maxReferenceVideos).toBe(10);
    expect(rules?.priceEstimate?.promos).toEqual([
      {
        id: "d25d8019-2cab-4229-a632-bf35321d96d8",
        resolution: "1080p",
        startsAt: "2026-08-14",
        endsAt: "2026-09-17",
        discountFold: 7.2,
      },
    ]);
  });

  it("returns undefined for non-Seedance ids", () => {
    expect(
      getSeedanceDefaultParameterRules("doubao-seedream-5")
    ).toBeUndefined();
  });
});

describe("isSeedance25PlatformModel", () => {
  it("matches Admin platform Seedance 2.5 tier", () => {
    expect(SEEDANCE_25_PLATFORM_CANONICAL_IDS).toContain("doubao-seedance-2-5");
    expect(isSeedance25PlatformModel("doubao-seedance-2-5")).toBe(true);
    expect(isSeedance25PlatformModel("doubao-seedance-2")).toBe(false);
  });
});
