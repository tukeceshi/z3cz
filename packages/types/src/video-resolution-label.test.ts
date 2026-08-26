import { describe, expect, it } from "vitest";

import {
  VIDEO_PRICE_ESTIMATE_RESOLUTIONS,
  VIDEO_RESOLUTION_OPTIONS,
  formatVideoResolutionLabel,
} from "./video-resolution-label";

describe("VIDEO_RESOLUTION_OPTIONS", () => {
  it("includes 768p and 2k in order", () => {
    expect([...VIDEO_RESOLUTION_OPTIONS]).toEqual([
      "480p",
      "720p",
      "768p",
      "1080p",
      "2k",
      "4k",
    ]);
    expect(VIDEO_PRICE_ESTIMATE_RESOLUTIONS).toBe(VIDEO_RESOLUTION_OPTIONS);
  });
});

describe("formatVideoResolutionLabel", () => {
  it("maps known resolutions to display labels", () => {
    expect(formatVideoResolutionLabel("480p")).toBe("480p");
    expect(formatVideoResolutionLabel("720p")).toBe("720p");
    expect(formatVideoResolutionLabel("768p")).toBe("768P");
    expect(formatVideoResolutionLabel("1080p")).toBe("1080p");
    expect(formatVideoResolutionLabel("2k")).toBe("2K");
    expect(formatVideoResolutionLabel("4k")).toBe("4k");
  });

  it("normalizes casing before lookup", () => {
    expect(formatVideoResolutionLabel(" 768P ")).toBe("768P");
    expect(formatVideoResolutionLabel("2K")).toBe("2K");
  });

  it("returns unknown values unchanged", () => {
    expect(formatVideoResolutionLabel("custom")).toBe("custom");
  });
});
