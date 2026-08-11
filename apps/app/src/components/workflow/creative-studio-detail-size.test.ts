import { describe, expect, it } from "vitest";

import {
  fitStudioDetailContentSize,
  fitStudioDetailSize,
  STUDIO_DETAIL_MEDIA_BORDER_PX,
} from "./creative-studio-detail-size";

describe("fitStudioDetailContentSize", () => {
  it("fills width first for landscape media", () => {
    expect(fitStudioDetailContentSize(800, 500, 16 / 9)).toEqual({
      width: 800,
      height: 450,
    });
  });

  it("falls back to height when landscape media is too tall", () => {
    const size = fitStudioDetailContentSize(800, 300, 16 / 9);
    expect(size?.width).toBeCloseTo(533.33, 1);
    expect(size?.height).toBe(300);
  });

  it("fills height first for portrait media", () => {
    expect(fitStudioDetailContentSize(800, 500, 9 / 16)).toEqual({
      width: 281.25,
      height: 500,
    });
  });

  it("falls back to width when portrait media is too wide", () => {
    const size = fitStudioDetailContentSize(200, 500, 9 / 16);
    expect(size?.width).toBe(200);
    expect(size?.height).toBeCloseTo(355.56, 1);
  });

  it("does not upscale past natural pixel size", () => {
    expect(fitStudioDetailContentSize(800, 500, 16 / 9, 400, 225)).toEqual({
      width: 400,
      height: 225,
    });
  });

  it("still shrinks when natural size exceeds the container", () => {
    const size = fitStudioDetailContentSize(400, 300, 16 / 9, 1600, 900);
    expect(size?.width).toBeCloseTo(400);
    expect(size?.height).toBeCloseTo(225);
  });
});

describe("fitStudioDetailSize", () => {
  it("expands outer size by border width", () => {
    const content = fitStudioDetailContentSize(800, 500, 16 / 9);
    const bordered = fitStudioDetailSize(802, 502, 16 / 9, undefined, undefined, 1);
    expect(content).toEqual({ width: 800, height: 450 });
    expect(bordered).toEqual({ width: 802, height: 452 });
  });

  it("keeps inner content aspect ratio when border is applied", () => {
    const aspect = 1023 / 1537;
    const size = fitStudioDetailSize(400, 600, aspect, 1023, 1537, 1);
    expect(size).not.toBeNull();
    const innerWidth = size!.width - 2 * STUDIO_DETAIL_MEDIA_BORDER_PX;
    const innerHeight = size!.height - 2 * STUDIO_DETAIL_MEDIA_BORDER_PX;
    expect(innerWidth / innerHeight).toBeCloseTo(aspect, 5);
  });
});
