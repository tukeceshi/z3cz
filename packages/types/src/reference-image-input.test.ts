import { describe, expect, it } from "vitest";

import {
  formatReferenceImageInline,
  mergeReferenceImageValues,
} from "./reference-image-input";

describe("reference-image-input", () => {
  it("formats inline base64 as data URI", () => {
    expect(
      formatReferenceImageInline({ mimeType: "image/png", data: "abc" })
    ).toBe("data:image/png;base64,abc");
  });

  it("merges urls and inline values", () => {
    expect(
      mergeReferenceImageValues({
        referenceImageUrls: ["https://example.com/a.jpg"],
        referenceImageInline: [{ mimeType: "image/jpeg", data: "xyz" }],
      })
    ).toEqual([
      "https://example.com/a.jpg",
      "data:image/jpeg;base64,xyz",
    ]);
  });
});
