import { describe, expect, it } from "vitest";

import { resolveAiTextEffectivePrompt } from "./platform-ai-model";

describe("resolveAiTextEffectivePrompt", () => {
  it("combines connected keywords with manual prompt", () => {
    expect(
      resolveAiTextEffectivePrompt({
        keywords: " upstream ",
        prompt: "manual",
      })
    ).toBe("upstream\n\nmanual");
  });

  it("uses keywords alone when prompt is empty", () => {
    expect(
      resolveAiTextEffectivePrompt({
        keywords: " upstream ",
        prompt: " ",
      })
    ).toBe("upstream");
  });

  it("falls back to manual prompt", () => {
    expect(
      resolveAiTextEffectivePrompt({
        prompt: " manual ",
      })
    ).toBe("manual");
  });

  it("returns empty string when both are empty", () => {
    expect(
      resolveAiTextEffectivePrompt({
        keywords: "   ",
        prompt: "",
      })
    ).toBe("");
  });
});
