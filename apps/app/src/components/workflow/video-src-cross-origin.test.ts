import { describe, expect, it } from "vitest";

import { videoSrcAllowsCrossOrigin } from "./video-src-cross-origin";

describe("videoSrcAllowsCrossOrigin", () => {
  it("allows blob URLs", () => {
    expect(videoSrcAllowsCrossOrigin("blob:http://localhost/abc")).toBe(true);
  });

  it("rejects upstream ephemeral URLs", () => {
    expect(
      videoSrcAllowsCrossOrigin("https://upstream.example.com/video.mp4")
    ).toBe(false);
  });
});
