import { describe, expect, it } from "vitest";

import { EMPTY_MEDIA_DISPLAY_URL_SET } from "@/services/ai-media-cache-service";

import { resolveMediaDisplayReadiness } from "./media-display-readiness";

const media = {
  mediaId: "m1",
  mimeType: "image/png",
} as const;

describe("resolveMediaDisplayReadiness", () => {
  it("returns empty when media is null", () => {
    expect(
      resolveMediaDisplayReadiness({
        media: null,
        urlSet: EMPTY_MEDIA_DISPLAY_URL_SET,
        size: "full",
        stale: false,
      })
    ).toEqual({ phase: "empty", displayUrl: null });
  });

  it("returns loading when stale", () => {
    expect(
      resolveMediaDisplayReadiness({
        media,
        urlSet: EMPTY_MEDIA_DISPLAY_URL_SET,
        size: "canvas-m",
        stale: true,
      })
    ).toEqual({ phase: "loading", displayUrl: null });
  });

  it("returns ready when pick size resolves", () => {
    expect(
      resolveMediaDisplayReadiness({
        media,
        urlSet: { full: null, s: "blob:s", m: null, l: null },
        size: "thumb",
        stale: false,
      })
    ).toEqual({ phase: "ready", displayUrl: "blob:s" });
  });

  it("returns missing when url set has no match", () => {
    expect(
      resolveMediaDisplayReadiness({
        media,
        urlSet: EMPTY_MEDIA_DISPLAY_URL_SET,
        size: "full",
        stale: false,
      })
    ).toEqual({ phase: "missing", displayUrl: null });
  });
});
