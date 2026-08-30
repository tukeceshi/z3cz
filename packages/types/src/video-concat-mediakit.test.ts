import { describe, expect, it } from "vitest";

import { isSubmitVideoConcatUrlsValid } from "./video-concat-mediakit";

describe("video-concat-mediakit", () => {
  it("accepts one to 100 non-empty URLs", () => {
    expect(isSubmitVideoConcatUrlsValid(["https://example.com/a.mp4"])).toBe(
      true
    );
    expect(
      isSubmitVideoConcatUrlsValid([
        "https://example.com/a.mp4",
        "https://example.com/b.mp4",
      ])
    ).toBe(true);
  });

  it("rejects empty, blank, or oversized URL lists", () => {
    expect(isSubmitVideoConcatUrlsValid([])).toBe(false);
    expect(isSubmitVideoConcatUrlsValid([" "])).toBe(false);
    expect(
      isSubmitVideoConcatUrlsValid(
        Array.from({ length: 101 }, (_, index) => `https://example.com/${index}`)
      )
    ).toBe(false);
  });
});
