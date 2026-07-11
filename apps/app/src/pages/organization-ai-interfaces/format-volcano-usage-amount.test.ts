import { describe, expect, it } from "vitest";

import { formatVolcanoUsageAmount } from "./format-volcano-usage-amount";

describe("formatVolcanoUsageAmount", () => {
  it("formats large token counts in millions (zh)", () => {
    expect(formatVolcanoUsageAmount(2_825_048, "tokens", "zh")).toBe(
      "2.83 百万 tokens"
    );
  });

  it("keeps sub-million token counts as-is", () => {
    expect(formatVolcanoUsageAmount(500_000, "tokens", "zh")).toBe(
      "500,000 tokens"
    );
  });

  it("formats exact millions without trailing decimals", () => {
    expect(formatVolcanoUsageAmount(5_000_000, "tokens", "zh")).toBe(
      "5 百万 tokens"
    );
  });

  it("formats image counts", () => {
    expect(formatVolcanoUsageAmount(50, "images", "zh")).toBe("50 张");
  });
});
