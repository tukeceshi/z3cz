import { describe, expect, it } from "vitest";

import {
  buildSeedanceTransformExamplePreset,
  describeFormatTransformTemplateRules,
  findTransformSchemaNodeById,
  isTransformMappingConfigComplete,
  resolveTransformUpstreamDisplayExample,
} from "./format-transform-template";

describe("format-transform-template presets", () => {
  it("builds seedance example with complete mappings", () => {
    const preset = buildSeedanceTransformExamplePreset();
    expect(preset.upstreamParams.map((param) => param.name)).toEqual([
      "prompt",
      "seconds",
      "size",
      "aspect_ratio",
      "resolution",
      "images",
      "first_frame",
      "last_frame",
      "reference_video",
      "reference_audio",
      "generate_audio",
      "model",
    ]);
    expect(
      isTransformMappingConfigComplete(
        preset.upstreamParams,
        preset.paramMappings
      )
    ).toBe(true);
  });

  it("rejects incomplete mapping config", () => {
    const preset = buildSeedanceTransformExamplePreset();
    expect(
      isTransformMappingConfigComplete(preset.upstreamParams, [])
    ).toBe(false);
  });

  it("describes configured template rules for display", () => {
    const preset = buildSeedanceTransformExamplePreset();
    const description = describeFormatTransformTemplateRules({
      upstreamParams: preset.upstreamParams,
      paramMappings: preset.paramMappings,
    });

    expect(description.mappings).toEqual(
      expect.arrayContaining([
        { upstreamParamName: "prompt", sourceLabel: "提示词" },
        {
          upstreamParamName: "size",
          sourceLabel: "比例+分辨率 → 尺寸",
        },
      ])
    );
  });
});

describe("resolveTransformUpstreamDisplayExample", () => {
  it("shows converted upstream values for common schema nodes", () => {
    expect(
      resolveTransformUpstreamDisplayExample(
        findTransformSchemaNodeById("prompt")!
      )
    ).toBe("一剑开天门");
    expect(
      resolveTransformUpstreamDisplayExample(
        findTransformSchemaNodeById("reference_images_string")!
      )
    ).toEqual(["https://example.com/ref.png"]);
    expect(
      resolveTransformUpstreamDisplayExample(
        findTransformSchemaNodeById("reference_images_object")!
      )
    ).toEqual([{ url: "https://example.com/ref.png" }]);
    expect(
      resolveTransformUpstreamDisplayExample(findTransformSchemaNodeById("size")!)
    ).toBe("1280x720");
  });
});