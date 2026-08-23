import { describe, expect, it } from "vitest";

import {
  hasDisplayUrlForSize,
  isMediaDisplayTierPending,
  pickMediaDisplayUrl,
} from "./ai-media-cache-service";

describe("pickMediaDisplayUrl", () => {
  it("returns only the exact tier url without falling back to full", () => {
    const set = {
      full: "blob:full",
      s: null,
      m: null,
      l: null,
    };

    expect(pickMediaDisplayUrl(set, "canvas-s")).toBeNull();
    expect(pickMediaDisplayUrl(set, "thumb")).toBeNull();
    expect(pickMediaDisplayUrl(set, "full")).toBe("blob:full");
  });

  it("returns only the requested canvas tier", () => {
    const set = {
      full: null,
      s: "blob:s",
      m: "blob:m",
      l: null,
    };

    expect(pickMediaDisplayUrl(set, "canvas-s")).toBe("blob:s");
    expect(pickMediaDisplayUrl(set, "canvas-m")).toBe("blob:m");
    expect(pickMediaDisplayUrl(set, "canvas-l")).toBeNull();
  });
});

describe("hasDisplayUrlForSize", () => {
  it("matches strict pickMediaDisplayUrl for each canvas tier", () => {
    const set = {
      full: null,
      s: null,
      m: "blob:m",
      l: null,
    };

    expect(hasDisplayUrlForSize(set, "canvas-s")).toBe(false);
    expect(hasDisplayUrlForSize(set, "canvas-m")).toBe(true);
    expect(hasDisplayUrlForSize(set, "canvas-l")).toBe(false);
  });

  it("does not treat full as thumb or canvas-s", () => {
    const set = {
      full: "blob:full",
      s: null,
      m: null,
      l: null,
    };

    expect(hasDisplayUrlForSize(set, "thumb")).toBe(false);
    expect(hasDisplayUrlForSize(set, "canvas-s")).toBe(false);
    expect(hasDisplayUrlForSize(set, "full")).toBe(true);
  });
});

describe("isMediaDisplayTierPending", () => {
  it("is pending when full exists but the requested tier is missing", () => {
    const set = {
      full: "blob:full",
      s: null,
      m: null,
      l: null,
    };

    expect(isMediaDisplayTierPending(set, "canvas-m")).toBe(true);
    expect(isMediaDisplayTierPending(set, "canvas-s")).toBe(true);
  });

  it("is not pending when the requested tier is ready", () => {
    const set = {
      full: "blob:full",
      s: "blob:s",
      m: null,
      l: null,
    };

    expect(isMediaDisplayTierPending(set, "canvas-s")).toBe(false);
  });
});
