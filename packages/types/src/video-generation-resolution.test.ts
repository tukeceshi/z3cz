import { describe, expect, it } from "vitest";

import {
  inferVideoGenerationResolution,
  isVideoRetakeResolutionMismatch,
  pickAllowedVideoResolution,
  resolveDefaultVideoGenerationResolution,
  resolveRetakeAutoResolution,
  resolveRetakeDefaultResolutionFromSource,
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

  it("detects retake resolution mismatch against source dimensions", () => {
    expect(
      isVideoRetakeResolutionMismatch({
        selected: "720p",
        sourceWidth: 1920,
        sourceHeight: 1080,
      })
    ).toBe(true);

    expect(
      isVideoRetakeResolutionMismatch({
        selected: "1080p",
        sourceWidth: 1920,
        sourceHeight: 1080,
      })
    ).toBe(false);

    expect(
      isVideoRetakeResolutionMismatch({
        selected: "720p",
        sourceWidth: null,
        sourceHeight: null,
      })
    ).toBe(true);
  });

  it("uses source pixels when probed and model fallback when not", () => {
    expect(
      resolveRetakeAutoResolution({
        width: 1920,
        height: 1080,
        modelFallback: "720p",
      })
    ).toBe("1080p");

    expect(
      resolveRetakeAutoResolution({
        width: null,
        height: null,
        modelFallback: "720p",
      })
    ).toBe("720p");
  });

  it("uses Seedance 2.5 pixel table for retake source resolution", () => {
    expect(
      resolveRetakeDefaultResolutionFromSource({
        width: 1920,
        height: 1080,
      })
    ).toBe("1080p");

    expect(
      resolveRetakeDefaultResolutionFromSource({
        width: 480,
        height: 854,
      })
    ).toBe("480p");

    expect(
      resolveRetakeDefaultResolutionFromSource({
        width: 496,
        height: 864,
      })
    ).toBeNull();

    expect(
      resolveDefaultVideoGenerationResolution({
        width: 1920,
        height: 1080,
        allowedValues: ["480p", "720p"],
        fallback: "720p",
      })
    ).toBe("720p");

    expect(
      resolveRetakeDefaultResolutionFromSource({
        width: null,
        height: null,
      })
    ).toBeNull();
  });

  it("treats unmatched Seedance 2.5 pixels as retake mismatch", () => {
    expect(
      isVideoRetakeResolutionMismatch({
        selected: "480p",
        sourceWidth: 496,
        sourceHeight: 864,
      })
    ).toBe(true);

    expect(
      resolveRetakeAutoResolution({
        width: 496,
        height: 864,
        modelFallback: "720p",
      })
    ).toBe("720p");
  });
});
