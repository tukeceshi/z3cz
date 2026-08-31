import { describe, expect, it } from "vitest";

import {
  matchSeedance25ResolutionFromPixels,
  SEEDANCE_25_RESOLUTION_PIXEL_COUNT,
} from "./seedance-25-resolution-pixels";

describe("seedance-25-resolution-pixels", () => {
  it("indexes 18 pixel pairs for 480p/720p/1080p", () => {
    expect(SEEDANCE_25_RESOLUTION_PIXEL_COUNT).toBe(18);
  });

  it("matches Seedance 2.5 output pixels to resolution tiers", () => {
    expect(matchSeedance25ResolutionFromPixels(854, 480)).toBe("480p");
    expect(matchSeedance25ResolutionFromPixels(480, 854)).toBe("480p");
    expect(matchSeedance25ResolutionFromPixels(1280, 720)).toBe("720p");
    expect(matchSeedance25ResolutionFromPixels(1920, 1080)).toBe("1080p");
    expect(matchSeedance25ResolutionFromPixels(1112, 834)).toBe("720p");
  });

  it("does not match Seedance 2.0 pixels or 4k", () => {
    expect(matchSeedance25ResolutionFromPixels(496, 864)).toBeNull();
    expect(matchSeedance25ResolutionFromPixels(864, 496)).toBeNull();
    expect(matchSeedance25ResolutionFromPixels(3840, 2160)).toBeNull();
  });
});
