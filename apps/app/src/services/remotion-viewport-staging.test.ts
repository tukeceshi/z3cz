import { describe, expect, it } from "vitest";

import {
  DEFAULT_REMOTION_SOURCE_CODE,
  parseRemotionViewportContent,
  serializeRemotionViewportContent,
} from "./remotion-viewport-staging";

describe("remotion viewport staging", () => {
  it("parses stored source code", () => {
    const content = parseRemotionViewportContent(
      serializeRemotionViewportContent({
        sourceCode: "function Composition() { return null; }",
      })
    );

    expect(content).toEqual({
      sourceCode: "function Composition() { return null; }",
    });
  });

  it("falls back when JSON is missing or invalid", () => {
    expect(parseRemotionViewportContent("")).toEqual({
      sourceCode: DEFAULT_REMOTION_SOURCE_CODE,
    });
    expect(parseRemotionViewportContent("{")).toEqual({
      sourceCode: DEFAULT_REMOTION_SOURCE_CODE,
    });
    expect(parseRemotionViewportContent("[]")).toEqual({
      sourceCode: DEFAULT_REMOTION_SOURCE_CODE,
    });
  });
});
