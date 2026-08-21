import { describe, expect, it } from "vitest";

import {
  applyVideoCapabilityLimits,
  buildPlatformVideoCapabilityBaseline,
  normalizeCapabilityLimitsForSave,
  resolveEffectiveCapabilityLimitsForEdit,
  resolveEffectiveVideoSupportsTaskCancel,
} from "./single-model-capability-limits";
import {
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
  normalizeVideoModelParameterRules,
} from "./platform-ai-model";
import {
  buildSingleModelEndpointUrlPreview,
  buildVideoPollUrl,
  buildVideoSubmitUrl,
  endpointRulesForMetadata,
  resolveOfficialVideoEndpoints,
  resolveSingleModelVideoEndpoints,
  resolveVideoTaskCancelSupport,
} from "./single-model-endpoint-rules";

describe("single-model-endpoint-rules", () => {
  it("returns official defaults with optional full submit url", () => {
    expect(resolveSingleModelVideoEndpoints({ category: "video" })).toEqual(
      resolveOfficialVideoEndpoints("video")
    );
    expect(
      resolveSingleModelVideoEndpoints({
        category: "video",
        metadata: {
          singleModelCategory: "video",
          endpointRules: { useFullSubmitUrl: true },
        },
      })
    ).toEqual({
      submitPath: "/contents/generations/tasks",
      supportsTaskCancel: true,
      useFullSubmitUrl: true,
    });
  });

  it("uses explicit cancel support for custom video rules", () => {
    expect(
      resolveSingleModelVideoEndpoints({
        category: "video",
        metadata: {
          singleModelCategory: "video",
          endpointRules: { useOfficial: false },
        },
        supportsTaskCancel: true,
      })
    ).toEqual({
      submitPath: "/contents/generations/tasks",
      supportsTaskCancel: true,
      useFullSubmitUrl: false,
    });
  });

  it("resolves cancel support from platform rules and org limits", () => {
    const platformRules = normalizeVideoModelParameterRules({
      ...DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
      supportsTaskCancel: true,
    });

    expect(
      resolveVideoTaskCancelSupport({
        canonicalId: "doubao-seedance-2",
        channelKind: "api",
        platformRules,
        capabilityLimits: { supportsTaskCancel: false },
      })
    ).toBe(false);
  });

  it("builds submit and poll urls from suffix settings", () => {
    expect(
      buildVideoSubmitUrl({
        baseUrl: "https://host/v1",
        submitPath: "/contents/generations/tasks",
      })
    ).toBe("https://host/v1/contents/generations/tasks");

    expect(
      buildVideoSubmitUrl({
        baseUrl: "https://host/v1/custom",
        submitPath: "/contents/generations/tasks",
        useFullSubmitUrl: true,
      })
    ).toBe("https://host/v1/custom");

    expect(
      buildVideoPollUrl({
        baseUrl: "https://host/v1/custom",
        submitPath: "/contents/generations/tasks",
        taskId: "abc",
        useFullSubmitUrl: true,
      })
    ).toBe("https://host/v1/custom/abc");
  });

  it("builds endpoint preview from suffix settings", () => {
    expect(
      buildSingleModelEndpointUrlPreview({
        baseUrl: "https://host/v1",
        category: "video",
        useFullSubmitUrl: false,
      })
    ).toEqual({
      fullUrlPreview: "https://host/v1/contents/generations/tasks",
    });

    expect(
      buildSingleModelEndpointUrlPreview({
        baseUrl: "https://host/v1",
        category: "text",
        useFullSubmitUrl: false,
      })
    ).toEqual({
      fullUrlPreview: "https://host/v1/chat/completions",
    });

    expect(
      buildSingleModelEndpointUrlPreview({
        baseUrl: "https://host/v1/full",
        category: "image",
        useFullSubmitUrl: true,
      })
    ).toEqual({
      fullUrlPreview: "https://host/v1/full",
    });
  });

  it("persists official and custom rules independently", () => {
    expect(
      endpointRulesForMetadata({
        useOfficial: true,
        useFullSubmitUrl: false,
      })
    ).toBeUndefined();

    expect(
      endpointRulesForMetadata({
        useOfficial: false,
        useFullSubmitUrl: false,
      })
    ).toEqual({ useOfficial: false });
  });
});

describe("single-model-capability-limits", () => {
  it("replaces resolution field from org limits", () => {
    const platformRules = normalizeVideoModelParameterRules(
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES
    );
    const platformResolution = platformRules.generationFields.find(
      (field) => field.name === "resolution"
    );
    expect(platformResolution).toBeDefined();

    const limited = applyVideoCapabilityLimits(platformRules, {
      resolution: {
        ...platformResolution!,
        enumValues: ["720p"],
        default: "720p",
      },
    });
    const resolutionField = limited.generationFields.find(
      (field) => field.name === "resolution"
    );
    expect(resolutionField?.enumValues).toEqual(["720p"]);
    expect(resolutionField?.default).toBe("720p");
  });

  it("applies reference counts and duration from org limits", () => {
    const platformRules = normalizeVideoModelParameterRules(
      DEFAULT_VIDEO_MODEL_PARAMETER_RULES
    );
    const platformDuration = platformRules.generationFields.find(
      (field) => field.name === "duration"
    );
    expect(platformDuration).toBeDefined();

    const limited = applyVideoCapabilityLimits(platformRules, {
      maxReferenceImages: 1,
      maxReferenceVideos: 0,
      maxReferenceAudios: 1,
      duration: {
        ...platformDuration!,
        enumValues: ["5"],
        default: "5",
      },
    });

    expect(limited.maxReferenceImages).toBe(1);
    expect(limited.maxReferenceVideos).toBe(0);
    expect(limited.maxReferenceAudios).toBe(1);
    const durationField = limited.generationFields.find(
      (field) => field.name === "duration"
    );
    expect(durationField?.enumValues).toEqual(["5"]);
  });

  it("normalizes save payload to org-only diffs", () => {
    const platformBaseline = buildPlatformVideoCapabilityBaseline({
      rules: normalizeVideoModelParameterRules(
        DEFAULT_VIDEO_MODEL_PARAMETER_RULES
      ),
    });

    expect(
      normalizeCapabilityLimitsForSave({
        platformBaseline,
        limits: resolveEffectiveCapabilityLimitsForEdit({
          platformBaseline,
          storedLimits: null,
        }),
      })
    ).toBeNull();

    expect(
      normalizeCapabilityLimitsForSave({
        platformBaseline,
        limits: {
          maxReferenceImages: 1,
        },
      })
    ).toEqual({ maxReferenceImages: 1 });

    expect(
      normalizeCapabilityLimitsForSave({
        platformBaseline,
        limits: {
          ...resolveEffectiveCapabilityLimitsForEdit({
            platformBaseline,
            storedLimits: null,
          }),
          priceEstimateDiscountFold: 8,
        },
      })
    ).toEqual({ priceEstimateDiscountFold: 8 });

    expect(
      normalizeCapabilityLimitsForSave({
        platformBaseline,
        limits: { priceEstimateDiscountFold: 8 },
        priceEstimateEnabled: false,
      })
    ).toBeNull();
  });

  it("copies org price discount onto resolved rules without changing unit prices", () => {
    const platformRules = normalizeVideoModelParameterRules({
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
        ],
      },
    });

    const limited = applyVideoCapabilityLimits(platformRules, {
      priceEstimateDiscountFold: 8,
    });

    expect(limited.orgPriceDiscountFold).toBe(8);
    expect(limited.priceEstimate).toEqual(platformRules.priceEstimate);
  });

  it("org cannot enable cancel when platform disallows", () => {
    const platformRules = normalizeVideoModelParameterRules({
      ...DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
      supportsTaskCancel: false,
    });
    expect(
      resolveEffectiveVideoSupportsTaskCancel({
        platformRules,
        capabilityLimits: { supportsTaskCancel: true },
      })
    ).toBe(false);
  });
});
