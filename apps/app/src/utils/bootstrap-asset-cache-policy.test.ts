import { describe, expect, it } from "vitest";

import {
  shouldInterceptBootstrapAssetFetch,
  shouldSeedBootstrapAssetCache,
} from "./bootstrap-asset-cache-policy";

describe("bootstrap-asset-cache-policy", () => {
  it("keeps images in the asset cache", () => {
    expect(shouldSeedBootstrapAssetCache("/landing/dollface.jpg")).toBe(true);
    expect(shouldInterceptBootstrapAssetFetch("/landing/dollface.jpg")).toBe(
      true
    );
  });

  it("does not cache or intercept landing videos", () => {
    expect(shouldSeedBootstrapAssetCache("/landing/clip.mp4")).toBe(false);
    expect(shouldInterceptBootstrapAssetFetch("/landing/clip.mp4")).toBe(false);
  });

  it("still intercepts hashed app assets", () => {
    expect(shouldInterceptBootstrapAssetFetch("/assets/index.js")).toBe(true);
  });
});
