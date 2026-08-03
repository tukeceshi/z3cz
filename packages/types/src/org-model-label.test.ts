import { describe, expect, it } from "vitest";

import {
  buildOrgModelOptionId,
  formatCanvasModelLabel,
  parseOrgModelOptionId,
  resolveInterfaceModelAlias,
} from "./org-model-label";

describe("org-model-label", () => {
  it("formats canvas labels with channel prefix", () => {
    expect(
      formatCanvasModelLabel({ channelKind: "aggregate", alias: "DeepSeek" })
    ).toBe("[聚合] DeepSeek");
    expect(formatCanvasModelLabel({ channelKind: "api", alias: "DeepSeek" })).toBe(
      "[API] DeepSeek"
    );
  });

  it("round-trips option ids", () => {
    const optionId = buildOrgModelOptionId("iface-1", "deepseek-v4-flash");
    expect(parseOrgModelOptionId(optionId)).toEqual({
      interfaceId: "iface-1",
      canonicalId: "deepseek-v4-flash",
    });
  });

  it("falls back to platform display name when alias missing", () => {
    expect(
      resolveInterfaceModelAlias({
        alias: undefined,
        platformDisplayName: "Seed 1.8",
      })
    ).toBe("Seed 1.8");
    expect(
      resolveInterfaceModelAlias({
        alias: "  My Name  ",
        platformDisplayName: "Seed 1.8",
      })
    ).toBe("My Name");
  });
});
