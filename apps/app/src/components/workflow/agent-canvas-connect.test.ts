import { describe, expect, it } from "vitest";

import { generationModeToNodeType, parseGenerationMode } from "./agent-canvas-connect";

describe("generationModeToNodeType", () => {
  it("maps the four generation modes", () => {
    expect(generationModeToNodeType("text")).toBe("ai-text");
    expect(generationModeToNodeType("image")).toBe("ai-image");
    expect(generationModeToNodeType("video")).toBe("ai-video");
    expect(generationModeToNodeType("audio")).toBe("ai-audio");
  });
});

describe("parseGenerationMode", () => {
  it("accepts known modes only", () => {
    expect(parseGenerationMode("image")).toBe("image");
    expect(parseGenerationMode("other")).toBeUndefined();
  });
});
