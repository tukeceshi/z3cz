import { describe, expect, it } from "vitest";

import { resolveLandingVideoSrc } from "./console-prefetch";

describe("resolveLandingVideoSrc", () => {
  it("returns the original path when prefetch is inactive", async () => {
    await expect(resolveLandingVideoSrc("/landing/clip.mp4")).resolves.toBe(
      "/landing/clip.mp4"
    );
  });
});
