import type { BootstrapManifest } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  collectBootstrapAssetPaths,
  parseRemoteBootstrapManifest,
  planBootstrapSync,
} from "./bootstrap-sync-plan";

function sampleManifest(
  overrides: Partial<BootstrapManifest> = {}
): BootstrapManifest {
  return {
    version: 1,
    entry: "/assets/index-abc.js",
    css: ["/assets/index-abc.css"],
    shell: "/assets/shell-1111111111111111.gz",
    shellHash: "1111111111111111",
    manifestVersion: "aaaaaaaaaaaaaaaa",
    prefetchPacks: [
      {
        id: "shared",
        path: "/assets/prefetch-shared-2222222222222222.gz",
        hash: "2222222222222222",
        assets: ["/assets/shared.js"],
      },
    ],
    staticAssets: [
      { path: "/landing/dollface.jpg", hash: "3333333333333333" },
    ],
    routeToPacks: { "/": ["shared"] },
    ...overrides,
  };
}

describe("bootstrap-sync-plan", () => {
  it("collects shell, packs, and static asset paths", () => {
    expect(collectBootstrapAssetPaths(sampleManifest())).toEqual([
      "/assets/shell-1111111111111111.gz",
      "/assets/prefetch-shared-2222222222222222.gz",
      "/landing/dollface.jpg",
    ]);
  });

  it("returns up to date when manifest versions match", () => {
    const local = sampleManifest();
    const plan = planBootstrapSync(local, local);
    expect(plan).toEqual({
      upToDate: true,
      toUpload: [],
      toPruneKeys: [],
      skippedCount: 3,
    });
  });

  it("uploads only changed shell and prunes the old shell key", () => {
    const remote = sampleManifest();
    const local = sampleManifest({
      shell: "/assets/shell-4444444444444444.gz",
      shellHash: "4444444444444444",
      manifestVersion: "bbbbbbbbbbbbbbbb",
    });

    const plan = planBootstrapSync(local, remote);

    expect(plan.upToDate).toBe(false);
    expect(plan.toUpload).toEqual(["/assets/shell-4444444444444444.gz"]);
    expect(plan.toPruneKeys).toEqual(["shell-1111111111111111.gz"]);
    expect(plan.skippedCount).toBe(2);
  });

  it("uploads everything when remote manifest is missing", () => {
    const local = sampleManifest();
    const plan = planBootstrapSync(local, null);

    expect(plan.upToDate).toBe(false);
    expect(plan.toUpload).toEqual(collectBootstrapAssetPaths(local));
    expect(plan.toPruneKeys).toEqual([]);
    expect(plan.skippedCount).toBe(0);
  });

  it("parses remote manifest JSON", () => {
    const manifest = sampleManifest();
    const body = new TextEncoder().encode(JSON.stringify(manifest));
    expect(parseRemoteBootstrapManifest(body).manifestVersion).toBe(
      manifest.manifestVersion
    );
  });
});
