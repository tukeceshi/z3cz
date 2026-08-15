import { describe, expect, it } from "vitest";

import { placeholderMimeTypeForModality } from "./mark-media-resources-failed";

describe("placeholderMimeTypeForModality", () => {
  it("maps modalities to placeholder mime types", () => {
    expect(placeholderMimeTypeForModality("video")).toBe("video/mp4");
    expect(placeholderMimeTypeForModality("audio")).toBe("audio/mpeg");
    expect(placeholderMimeTypeForModality("image")).toBe("image/png");
  });
});
