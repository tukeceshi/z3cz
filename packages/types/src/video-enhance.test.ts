import { describe, expect, it } from "vitest";

import { referencesFitVideoModelReferenceLimits } from "./platform-ai-model";
import {
  buildVideoEnhanceOrgModelOption,
  buildVideoEnhanceModelParameterRules,
  clampVideoEnhanceFps,
  inferVideoEnhanceResolutionTier,
  isVideoEnhanceModelCanonicalId,
  listHigherVideoEnhanceResolutions,
  parseVideoEnhanceNodeConfig,
  parseVideoEnhanceSourceTierFromLabel,
  serializeVideoEnhanceNodeConfig,
  VIDEO_ENHANCE_META_KEY,
  VIDEO_ENHANCE_MODEL_CANONICAL_ID,
  VIDEO_ENHANCE_MODEL_PARAMETER_RULES,
} from "./video-enhance";

describe("video-enhance", () => {
  it("identifies the virtual enhance model id", () => {
    expect(isVideoEnhanceModelCanonicalId(VIDEO_ENHANCE_MODEL_CANONICAL_ID)).toBe(
      true
    );
    expect(isVideoEnhanceModelCanonicalId("doubao-seedance-2")).toBe(false);
  });

  it("limits enhance references to one video", () => {
    expect(
      referencesFitVideoModelReferenceLimits(
        { imageCount: 0, videoCount: 1, audioCount: 0 },
        VIDEO_ENHANCE_MODEL_PARAMETER_RULES
      )
    ).toBe(true);
    expect(
      referencesFitVideoModelReferenceLimits(
        { imageCount: 1, videoCount: 0, audioCount: 0 },
        VIDEO_ENHANCE_MODEL_PARAMETER_RULES
      )
    ).toBe(false);
    expect(
      referencesFitVideoModelReferenceLimits(
        { imageCount: 0, videoCount: 2, audioCount: 0 },
        VIDEO_ENHANCE_MODEL_PARAMETER_RULES
      )
    ).toBe(false);
  });

  it("builds org model option from enabled modes", () => {
    const option = buildVideoEnhanceOrgModelOption({
      interfaceId: "iface-1",
      enabledModes: ["fast", "standard"],
    });
    expect(option?.canonicalId).toBe(VIDEO_ENHANCE_MODEL_CANONICAL_ID);
    expect(option?.interfaceId).toBe("iface-1");
    expect(
      buildVideoEnhanceModelParameterRules(["fast", "standard"]).generationFields.find(
        (field) => field.name === "mode"
      )?.enumValues
    ).toEqual(["fast", "standard"]);
  });

  it("maps generation resolution labels to enhance tiers", () => {
    expect(parseVideoEnhanceSourceTierFromLabel("720p")).toBe("720P");
    expect(parseVideoEnhanceSourceTierFromLabel("1080p")).toBe("1080P");
    expect(parseVideoEnhanceSourceTierFromLabel("4k")).toBe("4K");
    expect(parseVideoEnhanceSourceTierFromLabel("480p")).toBe("720P");
    expect(parseVideoEnhanceSourceTierFromLabel(null)).toBeNull();
  });

  it("infers resolution tier from dimensions", () => {
    expect(inferVideoEnhanceResolutionTier(1280, 720)).toBe("720P");
    expect(inferVideoEnhanceResolutionTier(1920, 1080)).toBe("1080P");
    expect(inferVideoEnhanceResolutionTier(2560, 1440)).toBe("2K");
  });

  it("lists only higher resolutions", () => {
    expect(listHigherVideoEnhanceResolutions("1080P")).toEqual([
      "2K",
      "4K",
      "8K",
    ]);
    expect(listHigherVideoEnhanceResolutions("8K")).toEqual([]);
  });

  it("clamps fps", () => {
    expect(clampVideoEnhanceFps(24)).toBe(24);
    expect(clampVideoEnhanceFps(10)).toBe(20);
    expect(clampVideoEnhanceFps(200)).toBe(120);
  });

  it("round-trips node config in metadata", () => {
    const serialized = serializeVideoEnhanceNodeConfig({
      mode: "fast",
      resolution: "1080P",
      fps: 24,
      sourceResourceId: "res-1",
    });
    const parsed = parseVideoEnhanceNodeConfig({
      [VIDEO_ENHANCE_META_KEY]: serialized,
    });
    expect(parsed).toEqual({
      mode: "fast",
      resolution: "1080P",
      fps: 24,
      sourceResourceId: "res-1",
    });
  });
});
