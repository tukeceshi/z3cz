import { describe, expect, it } from "vitest";

import { contextWindowTokensForCanonicalId } from "./text-model-context-windows";

describe("contextWindowTokensForCanonicalId", () => {
  it("uses the published window when the stored value is the placeholder", () => {
    expect(contextWindowTokensForCanonicalId("deepseek-v4-flash", 1_048_576)).toBe(
      128_000
    );
  });

  it("keeps an admin-edited window", () => {
    expect(contextWindowTokensForCanonicalId("deepseek-v4-flash", 64_000)).toBe(
      64_000
    );
  });
});
