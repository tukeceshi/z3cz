import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  getBootstrapManifest,
  invalidateBootstrapAssetCache,
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

  it("loads shell manifest metadata", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-assets-"));
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
});
