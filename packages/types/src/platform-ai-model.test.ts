import { describe, expect, it } from "vitest";

import { resolveAiTextEffectivePrompt } from "./platform-ai-model";

describe("resolveAiTextEffectivePrompt", () => {
  it("prefers connected keywords over manual prompt", () => {
    expect(
      resolveAiTextEffectivePrompt({
        keywords: " upstream ",
        prompt: "manual",
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
