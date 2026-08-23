import { describe, expect, it } from "vitest";

import { EMPTY_MEDIA_DISPLAY_URL_SET } from "@/services/ai-media-cache-service";

import { resolveMediaDisplay } from "./media-display-readiness";

const media = {
  resourceId: "m1",
  mimeType: "image/png",
} as const;

describe("resolveMediaDisplay", () => {
  it("returns empty when media is null", () => {
    expect(
      resolveMediaDisplay({
        media: null,
        urlSet: EMPTY_MEDIA_DISPLAY_URL_SET,
        size: "full",
        stale: false,
      })
    ).toEqual({ phase: "empty", displayUrl: null });
  });

  it("returns loading when stale", () => {
    expect(
      resolveMediaDisplay({
        media,
        urlSet: EMPTY_MEDIA_DISPLAY_URL_SET,
        size: "canvas-m",
        stale: true,
      })
    ).toEqual({ phase: "loading", displayUrl: null });
  });

  it("returns ready when the requested tier resolves", () => {
    expect(
      resolveMediaDisplay({
        media,
        urlSet: { full: null, s: "blob:s", m: null, l: null },
        size: "thumb",
        stale: false,
      })
    ).toEqual({ phase: "ready", displayUrl: "blob:s" });
  });

  it("returns missing when url set has no match and nothing is pending", () => {
    expect(
      resolveMediaDisplay({
        media,
        urlSet: EMPTY_MEDIA_DISPLAY_URL_SET,
        size: "full",
        stale: false,
      })
    ).toEqual({ phase: "missing", displayUrl: null });
  });

  it("returns loading when full exists but the requested tier is not ready", () => {
    expect(
      resolveMediaDisplay({
        media,
        urlSet: { full: "blob:full", s: null, m: null, l: null },
        size: "canvas-m",
        stale: false,
      })
    ).toEqual({ phase: "loading", displayUrl: null });
  });

  it("returns ready for each tier once all three are available", () => {
    const urlSet = {
      full: "blob:full",
      s: "blob:s",
      m: "blob:m",
      l: "blob:l",
    };

    expect(resolveMediaDisplay({ media, urlSet, size: "thumb", stale: false })).toEqual({
      phase: "ready",
      displayUrl: "blob:s",
    });
    expect(
      resolveMediaDisplay({ media, urlSet, size: "canvas-m", stale: false })
    ).toEqual({
      phase: "ready",
      displayUrl: "blob:m",
    });
    expect(
      resolveMediaDisplay({ media, urlSet, size: "canvas-l", stale: false })
    ).toEqual({
      phase: "ready",
      displayUrl: "blob:l",
    });
  });
});
