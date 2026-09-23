import { describe, expect, it, vi } from "vitest";

import {
  releaseAssetUrls,
  resolveReleaseAssetUrls,
} from "./system-update-preparer-node";

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

  it("resolves a Gitee release attachment through its API", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 42 })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 7, name: "SHA256SUMS" }]))
      );
    await expect(
      resolveReleaseAssetUrls(
        "owner/repo",
        "gitee",
        "v1.2.3",
        "SHA256SUMS",
        fetchImpl
      )
    ).resolves.toEqual([
      "https://gitee.com/api/v5/repos/owner/repo/releases/42/attach_files/7/download",
    ]);
  });

  it("rejects untrusted versions and asset paths", () => {
    expect(() =>
      releaseAssetUrls("owner/repo", "github", "main", "../../payload")
    ).toThrow("无效");
  });
});
