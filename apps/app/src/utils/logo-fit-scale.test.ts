import { describe, expect, it } from "vitest";

import { contentFitScale, logoFitScale } from "./logo-fit-scale";

describe("contentFitScale", () => {
  it("stays at full size when there is enough room", () => {
    expect(contentFitScale(200, 120)).toBe(1);
  });

  it("scales down to fit with no floor", () => {
    expect(contentFitScale(100, 200)).toBe(0.5);
  });

  it("returns full size for invalid measurements", () => {
    expect(contentFitScale(0, 100)).toBe(1);
    expect(contentFitScale(100, 0)).toBe(1);
  });
});

describe("logoFitScale", () => {
  it("stays at full size when there is enough room", () => {
    expect(logoFitScale(200, 120)).toBe(1);
  });

  it("scales down to fit when space is tight", () => {
    expect(logoFitScale(100, 200)).toBe(0.65);
    expect(logoFitScale(160, 200)).toBe(0.8);
  });

  it("returns full size for invalid measurements", () => {
    expect(logoFitScale(0, 100)).toBe(1);
    expect(logoFitScale(100, 0)).toBe(1);
  });
});
