import { describe, expect, it } from "vitest";

import { generateImageThumbnail } from "./generate-image-thumbnail";

/** 1x1 red PNG */
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function base64ToBlob(base64: string, type = ""): Blob {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

describe("generateImageThumbnail", () => {
  it.skipIf(typeof createImageBitmap !== "function")(
    "generates a jpeg thumb when blob type is empty but mimeType is provided",
    async () => {
      const blob = base64ToBlob(TINY_PNG_BASE64);
      expect(blob.type).toBe("");

      const thumb = await generateImageThumbnail(blob, "image/png");

      expect(thumb).not.toBeNull();
      expect(thumb?.type).toBe("image/jpeg");
      expect(thumb!.size).toBeGreaterThan(0);
    }
  );

  it.skipIf(typeof createImageBitmap !== "function")(
    "generates a jpeg thumb when blob already has an image type",
    async () => {
      const blob = base64ToBlob(TINY_PNG_BASE64, "image/png");

      const thumb = await generateImageThumbnail(blob);

      expect(thumb).not.toBeNull();
      expect(thumb?.type).toBe("image/jpeg");
    }
  );

  it("returns null for non-image mime types", async () => {
    const blob = new Blob(["not-an-image"], { type: "text/plain" });

    await expect(generateImageThumbnail(blob)).resolves.toBeNull();
  });
});
