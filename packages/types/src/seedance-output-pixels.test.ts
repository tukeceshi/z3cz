import { describe, expect, it } from "vitest";

import {
  getSeedanceOutputPixels,
  resolveSeedanceSeries,
} from "./seedance-output-pixels";

describe("resolveSeedanceSeries", () => {
  it("maps Seedance 2.5 models", () => {
    expect(resolveSeedanceSeries("doubao-seedance-2-5")).toBe("2.5");
  });

  it("maps Seedance 2.0 models", () => {
    expect(resolveSeedanceSeries("doubao-seedance-2")).toBe("2.0");
    expect(resolveSeedanceSeries("doubao-seedance-2-fast")).toBe("2.0");
  });
});

describe("getSeedanceOutputPixels", () => {
  it("uses series-specific 480p 16:9 pixels", () => {
    expect(getSeedanceOutputPixels("2.5", "480p", "16:9")).toEqual({
      width: 854,
      height: 480,
    });
    expect(getSeedanceOutputPixels("2.0", "480p", "16:9")).toEqual({
      width: 864,
      height: 496,
    });
  });

  it("uses standard 720p 16:9 pixels", () => {
    expect(getSeedanceOutputPixels("2.5", "720p", "16:9")).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it("swaps 9:16 from standard 16:9", () => {
    expect(getSeedanceOutputPixels("2.0", "1080p", "9:16")).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it("uses ratio overrides for non-standard ratios", () => {
    expect(getSeedanceOutputPixels("2.5", "720p", "4:3")).toEqual({
      width: 1112,
      height: 834,
    });
  });
});
