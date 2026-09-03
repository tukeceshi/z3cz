import { describe, expect, it } from "vitest";

import { compileRemotionSource } from "./remotion-live-compile";
import { DEFAULT_REMOTION_SOURCE_CODE } from "./remotion-viewport-staging";

describe("remotion live compile", () => {
  it("compiles the default composition source", () => {
    const result = compileRemotionSource(DEFAULT_REMOTION_SOURCE_CODE);
    expect(result.error).toBeUndefined();
    expect(typeof result.component).toBe("function");
  });

  it("returns an error when Composition is missing", () => {
    const result = compileRemotionSource("function Demo() { return null; }");
    expect(result.component).toBeUndefined();
    expect(result.error).toMatch(/Composition/i);
  });
});
