import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  getBootstrapManifest,
  invalidateBootstrapAssetCache,
  resolveBootstrapAssetDiskPath,
} from "./bootstrap-asset-store";

function makeTempDir(): string {
  const dir = path.join(
    process.cwd(),
    `.vitest-bootstrap-assets-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

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

  it("loads shell manifest metadata", () => {
    tempDir = makeTempDir();
    fs.writeFileSync(
      path.join(tempDir, "bootstrap-manifest.json"),
      JSON.stringify({
        version: 1,
        entry: "/assets/entry.js",
        css: ["/assets/entry.css"],
        shell: "/assets/shell-test.gz",
        shellHash: "test",
        manifestVersion: "test",
      })
    );

    process.env.BOOTSTRAP_ASSETS_DIR = tempDir;

    const manifest = getBootstrapManifest();
    expect(manifest?.entry).toBe("/assets/entry.js");
    expect(manifest?.shell).toBe("/assets/shell-test.gz");
    expect(manifest?.shellHash).toBe("test");
  });

  it("reloads the manifest when the file on disk changes", () => {
    tempDir = makeTempDir();
    const manifestPath = path.join(tempDir, "bootstrap-manifest.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        version: 1,
        entry: "/assets/entry.js",
        css: [],
        shell: "/assets/shell-old.gz",
        shellHash: "old",
        manifestVersion: "old",
      })
    );
    process.env.BOOTSTRAP_ASSETS_DIR = tempDir;
    expect(getBootstrapManifest()?.manifestVersion).toBe("old");

    const previousMtime = fs.statSync(manifestPath).mtimeMs;
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        version: 1,
        entry: "/assets/entry.js",
        css: [],
        shell: "/assets/shell-new.gz",
        shellHash: "new",
        manifestVersion: "new",
      })
    );
    const nextMtime = previousMtime + 1000;
    fs.utimeSync(manifestPath, new Date(nextMtime), new Date(nextMtime));

    expect(getBootstrapManifest()?.manifestVersion).toBe("new");
  });

  it("resolves disk paths for assets and landing files", () => {
    const root = path.join("app", "dist");
    expect(resolveBootstrapAssetDiskPath(root, "/assets/shell-test.gz")).toBe(
      path.join(root, "assets", "shell-test.gz")
    );
    expect(resolveBootstrapAssetDiskPath(root, "/landing/clip.mp4")).toBe(
      path.join(root, "landing", "clip.mp4")
    );
  });

  it("falls back to public/ when a landing file is missing from dist", () => {
    tempDir = makeTempDir();
    const distDir = path.join(tempDir, "dist");
    const publicDir = path.join(tempDir, "public", "landing");
    fs.mkdirSync(distDir, { recursive: true });
    fs.mkdirSync(publicDir, { recursive: true });
    const publicFile = path.join(publicDir, "dollface.jpg");
    fs.writeFileSync(publicFile, "landing-bytes");

    expect(
      resolveBootstrapAssetDiskPath(distDir, "/landing/dollface.jpg")
    ).toBe(publicFile);
  });
});
