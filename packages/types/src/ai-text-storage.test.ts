import { describe, expect, it } from "vitest";

import { AI_TEXT_EXCERPT_MAX_CHARS, buildAiTextExcerpt } from "./ai-text-storage";

describe("ai-text-storage", () => {
  it("truncates long excerpts", () => {
    const long = "文".repeat(AI_TEXT_EXCERPT_MAX_CHARS + 10);
    const excerpt = buildAiTextExcerpt(long);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(AI_TEXT_EXCERPT_MAX_CHARS + 1);
  });
});
