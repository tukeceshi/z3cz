import { describe, expect, it } from "vitest";

import {
  fitGenerativeHistoryPreviewPlaceholder,
  fitGenerativeHistoryPreviewSize,
} from "./fit-generative-history-preview-size";

describe("fitGenerativeHistoryPreviewSize", () => {
  it("keeps natural size when within limits", () => {
    expect(fitGenerativeHistoryPreviewSize(600, 400, 300)).toEqual({
      width: 400,
      height: 300,
    });
  });

  it("scales down when height exceeds 500", () => {
    expect(fitGenerativeHistoryPreviewSize(800, 600, 800)).toEqual({
      width: 375,
      height: 500,
    });
  });

  it("scales down when width exceeds container", () => {
    expect(fitGenerativeHistoryPreviewSize(600, 800, 400)).toEqual({
      width: 600,
      height: 300,
    });
  });

  it("applies the tighter limit when both height and width overflow", () => {
    expect(fitGenerativeHistoryPreviewSize(800, 2000, 1200)).toEqual({
      width: 800,
      height: 480,
    });
  });

  it("never upscales", () => {
    expect(fitGenerativeHistoryPreviewSize(800, 200, 150)).toEqual({
      width: 200,
      height: 150,
    });
  });
});

describe("fitGenerativeHistoryPreviewPlaceholder", () => {
  it("fits landscape placeholder within width and height caps", () => {
    expect(fitGenerativeHistoryPreviewPlaceholder(800, 16 / 9)).toEqual({
      width: 800,
      height: 450,
    });
  });

  it("caps placeholder height at 500", () => {
    expect(fitGenerativeHistoryPreviewPlaceholder(400, 9 / 16)).toEqual({
      width: 281.25,
      height: 500,
    });
  });
});
