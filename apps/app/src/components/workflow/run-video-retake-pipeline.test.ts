import { describe, expect, it } from "vitest";

import { mergeRetakeReferenceVideoUrls } from "./run-video-retake-pipeline";

describe("mergeRetakeReferenceVideoUrls", () => {
  it("puts trim clip first and appends canvas videos without duplicates", () => {
    expect(
      mergeRetakeReferenceVideoUrls("https://example.com/trim.mp4", [
        "https://example.com/ref-a.mp4",
        "https://example.com/ref-b.mp4",
      ])
    ).toEqual([
      "https://example.com/trim.mp4",
      "https://example.com/ref-a.mp4",
      "https://example.com/ref-b.mp4",
    ]);

    expect(
      mergeRetakeReferenceVideoUrls("https://example.com/trim.mp4", [
        "https://example.com/trim.mp4",
        "https://example.com/ref-a.mp4",
      ])
    ).toEqual([
      "https://example.com/trim.mp4",
      "https://example.com/ref-a.mp4",
    ]);
  });
});
