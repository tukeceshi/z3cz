import { describe, expect, it } from "vitest";

import {
  getSingleModelApiPath,
  getSingleModelPresetsByCategory,
} from "./single-model-preset-catalog";

describe("single-model-preset-catalog", () => {
  it("groups independent presets without brand-provider models", () => {
    const grouped = getSingleModelPresetsByCategory();
    expect(grouped.text.some((entry) => entry.id === "preset:deepseek-v4-pro")).toBe(
      false
    );
    expect(
      grouped.text.some((entry) => entry.id === "preset:deepseek-v4-flash")
    ).toBe(false);
    expect(
      grouped.text.some((entry) => entry.id === "preset:doubao-seed-evolving")
    ).toBe(false);
    expect(grouped.text.some((entry) => entry.id === "preset:glm-5-2")).toBe(
      false
    );
    expect(grouped.text.some((entry) => entry.id === "preset:kimi-k3")).toBe(
      false
    );
    expect(grouped.text.some((entry) => entry.id === "preset:kimi-k2.6")).toBe(
      false
    );
    expect(grouped.text.some((entry) => entry.id === "preset:kimi-k2.5")).toBe(
      false
    );
    expect(grouped.text.some((entry) => entry.id === "preset:gpt-5-6-sol")).toBe(
      false
    );
    expect(grouped.text.some((entry) => entry.id === "preset:gpt-5-6-terra")).toBe(
      false
    );
    expect(grouped.text.some((entry) => entry.id === "preset:gpt-5-6-luna")).toBe(
      false
    );
    expect(grouped.image.some((entry) => entry.id === "preset:gpt-image-2")).toBe(
      false
    );
    expect(
      grouped.image.some((entry) => entry.id === "preset:gemini-3-1-flash-image")
    ).toBe(false);
    expect(
      grouped.image.some((entry) => entry.id === "preset:gemini-3-1-flash-lite-image")
    ).toBe(false);
    expect(
      grouped.image.some((entry) => entry.id === "preset:gemini-3-pro-image")
    ).toBe(false);
    expect(grouped.text.some((entry) => entry.id === "preset:gemini-3-5-flash")).toBe(
      false
    );
    expect(grouped.text.some((entry) => entry.id === "preset:gemini-3-6-flash")).toBe(
      false
    );
    expect(grouped.text.some((entry) => entry.id === "preset:gemini-3-5-flash-lite")).toBe(
      false
    );
    expect(grouped.video.some((entry) => entry.id === "preset:doubao-seedance-2")).toBe(
      false
    );
    expect(
      grouped.video.some((entry) => entry.id === "preset:doubao-seedance-2-fast")
    ).toBe(false);
    expect(
      grouped.video.some((entry) => entry.id === "preset:doubao-seedance-2-mini")
    ).toBe(false);
    expect(grouped.video.some((entry) => entry.id === "preset:veo-3-1-generate")).toBe(
      false
    );
    expect(
      grouped.video.some((entry) => entry.id === "preset:veo-3-1-fast-generate")
    ).toBe(false);
    expect(
      grouped.video.some((entry) => entry.id === "preset:veo-3-1-lite-generate")
    ).toBe(false);
    expect(grouped.text.some((entry) => entry.id === "preset:grok-4-5")).toBe(
      false
    );
    expect(grouped.text.some((entry) => entry.id === "preset:grok-4-3")).toBe(
      false
    );
    expect(
      grouped.image.some((entry) => entry.id === "preset:grok-imagine-image")
    ).toBe(false);
    expect(
      grouped.image.some(
        (entry) => entry.id === "preset:grok-imagine-image-quality"
      )
    ).toBe(false);
    expect(
      grouped.video.some((entry) => entry.id === "preset:grok-imagine-video")
    ).toBe(false);
    expect(
      grouped.video.some(
        (entry) => entry.id === "preset:grok-imagine-video-1-5"
      )
    ).toBe(false);
    expect(
      grouped.text.some((entry) => entry.id === "preset:claude-sonnet-5")
    ).toBe(false);
    expect(
      grouped.text.some((entry) => entry.id === "preset:claude-opus-5")
    ).toBe(false);
    expect(
      grouped.text.some((entry) => entry.id === "preset:claude-haiku-4-5")
    ).toBe(false);
    expect(
      grouped.image.some((entry) => entry.id === "preset:doubao-seedream-5")
    ).toBe(false);
    expect(grouped.text).toHaveLength(0);
    expect(grouped.image).toHaveLength(0);
    expect(grouped.video).toHaveLength(0);
    expect(grouped.storage).toHaveLength(0);
  });

  it("exposes API paths per modality category", () => {
    expect(getSingleModelApiPath("text")).toBe("/chat/completions");
    expect(getSingleModelApiPath("image")).toBe("/images/generations");
    expect(getSingleModelApiPath("video")).toBe(
      "/contents/generations/tasks"
    );
    expect(getSingleModelApiPath("audio")).toBe("/v1/t2a_v2");
    expect(getSingleModelApiPath("storage")).toBeUndefined();
  });
});
