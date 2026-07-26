import { describe, expect, it } from "vitest";

import { parseVolcanoFoundationModelReference } from "./parse-foundation-model-reference";

describe("parseVolcanoFoundationModelReference", () => {
  it("parses date-suffixed model ids", () => {
    expect(parseVolcanoFoundationModelReference("glm-5-2-260617")).toEqual({
      name: "glm-5-2",
      version: "260617",
    });
    expect(parseVolcanoFoundationModelReference("deepseek-v4-flash-260425")).toEqual({
      name: "deepseek-v4-flash",
      version: "260425",
    });
  });

  it("returns null for unsupported ids", () => {
    expect(parseVolcanoFoundationModelReference("doubao-seed-evolving")).toBeNull();
  });
});
