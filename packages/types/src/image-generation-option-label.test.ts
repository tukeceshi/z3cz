import { describe, expect, it } from "vitest";

import { formatImageGenerationOptionLabel } from "./image-generation-option-label";
import {
  buildVolcanoImageGenerationBody,
  DEFAULT_IMAGE_GENERATION_FIELDS,
} from "./platform-ai-model";

describe("formatImageGenerationOptionLabel", () => {
  it("shows smart label for auto size and ratio", () => {
    expect(
      formatImageGenerationOptionLabel("size", "auto", "智能")
    ).toBe("智能");
    expect(
      formatImageGenerationOptionLabel("ratio", "auto", "智能")
    ).toBe("智能");
  });

  it("keeps fixed values unchanged", () => {
    expect(formatImageGenerationOptionLabel("size", "2K", "智能")).toBe("2K");
  });

  it("localizes optimize prompt mode options", () => {
    expect(
      formatImageGenerationOptionLabel("optimize_prompt_mode", "standard", "智能", {
        optimizePromptStandard: "标准模式",
        optimizePromptFast: "快速(质量降低)",
      })
    ).toBe("标准模式");
    expect(
      formatImageGenerationOptionLabel("optimize_prompt_mode", "fast", "智能", {
        optimizePromptStandard: "标准模式",
        optimizePromptFast: "快速(质量降低)",
      })
    ).toBe("快速(质量降低)");
  });
});

describe("buildVolcanoImageGenerationBody size auto", () => {
  it("passes auto size to upstream", () => {
    const fields = DEFAULT_IMAGE_GENERATION_FIELDS.map((field) =>
      field.name === "size"
        ? {
            ...field,
            default: "auto",
            enumValues: ["auto", "1K", "2K", "4K"] as const,
          }
        : field
    );

    const body = buildVolcanoImageGenerationBody({
      providerModelId: "gpt-image-2",
      prompt: "a cat",
      generationFields: fields,
      params: { size: "auto" },
    });

    expect(body.size).toBe("auto");
  });
});
