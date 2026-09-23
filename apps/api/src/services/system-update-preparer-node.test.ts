import { describe, expect, it } from "vitest";

import { releaseAssetUrls } from "./system-update-preparer-node";

describe("releaseAssetUrls", () => {
  it("uses GitHub and its configured fallback mirror", () => {
    const urls = releaseAssetUrls(
      "owner/repo",
      "github",
      "v1.2.3",
      "z3cz-v1.2.3-deploy.tar.gz"
    );
    expect(urls[0]).toBe(
      "https://github.com/owner/repo/releases/download/v1.2.3/z3cz-v1.2.3-deploy.tar.gz"
    );
    expect(urls[1]).toContain(urls[0]);
  });

  it("uses the Gitee release asset path", () => {
    expect(
      releaseAssetUrls("owner/repo", "gitee", "v1.2.3", "SHA256SUMS")
    ).toEqual([
      "https://gitee.com/owner/repo/releases/download/v1.2.3/SHA256SUMS",
    ]);
  });

  it("rejects untrusted versions and asset paths", () => {
    expect(() =>
      releaseAssetUrls("owner/repo", "github", "main", "../../payload")
    ).toThrow("无效");
  });
});
