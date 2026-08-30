import { describe, expect, it } from "vitest";

import {
  inferVideoGenerationResolution,
  pickAllowedVideoResolution,
  resolveDefaultVideoGenerationResolution,
} from "./video-generation-resolution";

describe("video-generation-resolution", () => {
  it("infers resolution tier from video dimensions", () => {
    expect(inferVideoGenerationResolution(1280, 720)).toBe("720p");
    expect(inferVideoGenerationResolution(1920, 1080)).toBe("1080p");
    expect(inferVideoGenerationResolution(854, 480)).toBe("480p");
    expect(inferVideoGenerationResolution(3840, 2160)).toBe("4k");
  });

  it("picks the highest allowed tier not above the inferred source tier", () => {
    expect(
      pickAllowedVideoResolution({
        inferred: "1080p",
        allowedValues: ["480p", "720p", "1080p"],
        fallback: "720p",
      })
    ).toBe("1080p");

    expect(
      pickAllowedVideoResolution({
        inferred: "1080p",
        allowedValues: ["480p", "720p"],
        fallback: "720p",
      })
    ).toBe("720p");
  });

  it("falls back when dimensions are missing", () => {
    expect(
      resolveDefaultVideoGenerationResolution({
        width: null,
        height: null,
        allowedValues: ["480p", "720p", "1080p"],
        fallback: "720p",
      })
    ).toBe("720p");
  });

  it("resolves an allowed default from source dimensions", () => {
    expect(
      resolveDefaultVideoGenerationResolution({
        width: 1920,
        height: 1080,
        allowedValues: ["480p", "720p", "1080p"],
        fallback: "720p",
      })
    ).toBe("1080p");
  });
});
