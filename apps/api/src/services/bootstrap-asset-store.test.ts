import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  computeManifestVersion,
  getBootstrapManifest,
  getBootstrapPreloadFiles,
  invalidateBootstrapAssetCache,
  isBootstrapAssetPath,
  readBootstrapAsset,
} from "./bootstrap-asset-store";

describe("bootstrap-asset-store", () => {
  let tempDir = "";

  afterEach(() => {
    invalidateBootstrapAssetCache();
    if (tempDir) {
      fs.rmSync(tempDir, { force: true, recursive: true });
      tempDir = "";
    }
    delete process.env.BOOTSTRAP_ASSETS_DIR;
  });

  it("loads manifest and serves whitelisted assets only", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-assets-"));
    const assetsDir = path.join(tempDir, "assets");
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, "entry.js"), "console.log('entry');");
    fs.writeFileSync(
      path.join(tempDir, "bootstrap-manifest.json"),
      JSON.stringify({
        version: 1,
        entry: "/assets/entry.js",
        css: [],
        files: [{ path: "/assets/entry.js", size: 21 }],
        preloadFiles: [{ path: "/assets/entry.js", size: 21 }],
        manifestVersion: "test",
      })
    );

    process.env.BOOTSTRAP_ASSETS_DIR = tempDir;

    const manifest = getBootstrapManifest();
    expect(manifest?.entry).toBe("/assets/entry.js");
    expect(isBootstrapAssetPath("/assets/entry.js")).toBe(true);
    expect(isBootstrapAssetPath("/assets/other.js")).toBe(false);

    const bytes = readBootstrapAsset("/assets/entry.js");
    expect(bytes?.toString("utf8")).toContain("entry");
  });

  it("computes stable manifest versions", () => {
    const version = computeManifestVersion([
      { path: "/assets/a.js", size: 10 },
      { path: "/assets/b.js", size: 20 },
    ]);
    expect(version).toHaveLength(16);
  });

  it("returns explicit preload files or falls back to largest assets", () => {
    const manifest = {
      version: 1 as const,
      entry: "/assets/entry.js",
      css: [],
      files: [
        { path: "/assets/small.js", size: 1 },
        { path: "/assets/large.js", size: 100 },
        { path: "/assets/entry.js", size: 21 },
      ],
      manifestVersion: "test",
    };

    expect(getBootstrapPreloadFiles(manifest).map((file) => file.path)).toEqual([
      "/assets/large.js",
      "/assets/entry.js",
      "/assets/small.js",
    ]);

    expect(
      getBootstrapPreloadFiles({
        ...manifest,
        preloadFiles: [{ path: "/assets/entry.js", size: 21 }],
      }).map((file) => file.path)
    ).toEqual(["/assets/entry.js"]);
  });
});
