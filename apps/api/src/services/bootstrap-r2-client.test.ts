import { describe, expect, it } from "vitest";

import {
  bootstrapR2ObjectName,
  buildBootstrapR2ObjectKey,
  buildBootstrapR2PublicUrl,
  contentTypeForBootstrapAsset,
  findNonBootstrapAccelerationObjectKeys,
  isBootstrapAccelerationObjectKey,
} from "./bootstrap-r2-client";

describe("bootstrap-r2-client path helpers", () => {
  it("keeps existing asset object names without the /assets prefix", () => {
    expect(bootstrapR2ObjectName("/assets/shell-deadbeef.gz")).toBe(
      "shell-deadbeef.gz"
    );
    expect(buildBootstrapR2ObjectKey("/assets/shell-deadbeef.gz")).toBe(
      "shell-deadbeef.gz"
    );
    expect(
      buildBootstrapR2PublicUrl(
        "https://cdn.example.com/",
        "/assets/shell-deadbeef.gz"
      )
    ).toBe("https://cdn.example.com/shell-deadbeef.gz");
  });

  it("maps landing files to landing/... keys", () => {
    expect(bootstrapR2ObjectName("/landing/dollface.jpg")).toBe(
      "landing/dollface.jpg"
    );
    expect(
      buildBootstrapR2PublicUrl("https://cdn.example.com", "/landing/clip.mp4")
    ).toBe("https://cdn.example.com/landing/clip.mp4");
  });

  it("picks content types for gzip packs and landing media", () => {
    expect(contentTypeForBootstrapAsset("/assets/shell.gz")).toBe(
      "application/gzip"
    );
    expect(contentTypeForBootstrapAsset("/landing/dollface.jpg")).toBe(
      "image/jpeg"
    );
    expect(contentTypeForBootstrapAsset("/landing/clip.mp4")).toBe("video/mp4");
  });

  it("recognizes bootstrap acceleration object keys", () => {
    expect(isBootstrapAccelerationObjectKey("bootstrap-manifest.json")).toBe(
      true
    );
    expect(isBootstrapAccelerationObjectKey("shell-deadbeef.gz")).toBe(true);
    expect(
      isBootstrapAccelerationObjectKey("prefetch-shared-deadbeef.gz")
    ).toBe(true);
    expect(isBootstrapAccelerationObjectKey("landing/dollface.jpg")).toBe(true);
    expect(isBootstrapAccelerationObjectKey("other/file.txt")).toBe(false);
  });

  it("finds foreign bucket keys", () => {
    expect(
      findNonBootstrapAccelerationObjectKeys([
        "shell-deadbeef.gz",
        "other/file.txt",
      ])
    ).toEqual(["other/file.txt"]);
  });
});
