import { describe, expect, it } from "vitest";

import { fitStudioDetailSize } from "./creative-studio-detail-size";

describe("fitStudioDetailSize", () => {
  it("fills width first for landscape media", () => {
    expect(fitStudioDetailSize(800, 500, 16 / 9)).toEqual({
      width: 800,
      height: 450,
    });
  });

  it("falls back to height when landscape media is too tall", () => {
    const size = fitStudioDetailSize(800, 300, 16 / 9);
    expect(size?.width).toBeCloseTo(533.33, 1);
    expect(size?.height).toBe(300);
  });

  it("fills height first for portrait media", () => {
    expect(fitStudioDetailSize(800, 500, 9 / 16)).toEqual({
      width: 281.25,
      height: 500,
    });
  });

  it("falls back to width when portrait media is too wide", () => {
    const size = fitStudioDetailSize(200, 500, 9 / 16);
    expect(size?.width).toBe(200);
    expect(size?.height).toBeCloseTo(355.56, 1);
  });

  it("does not upscale past natural pixel size", () => {
    expect(fitStudioDetailSize(800, 500, 16 / 9, 400, 225)).toEqual({
      width: 400,
      height: 225,
    });
  });

  it("still shrinks when natural size exceeds the container", () => {
    const size = fitStudioDetailSize(400, 300, 16 / 9, 1600, 900);
    expect(size?.width).toBeCloseTo(400);
    expect(size?.height).toBeCloseTo(225);
  });
});
