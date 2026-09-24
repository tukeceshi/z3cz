import assert from "node:assert/strict";
import test from "node:test";

import {
  checksumForAsset,
  releaseAssetUrl,
  updaterArch,
  updaterAssetName,
} from "./github.mjs";

test("checksumForAsset reads the matching file name", () => {
  const sums = [
    "abc123  z3cz-host-updater-linux-amd64",
    "def456  z3cz-host-updater-linux-arm64",
  ].join("\n");
  assert.equal(
    checksumForAsset(sums, "z3cz-host-updater-linux-amd64"),
    "abc123"
  );
  assert.equal(checksumForAsset(sums, "missing"), "");
});

test("updaterAssetName maps node arch to release asset names", () => {
  assert.equal(updaterArch("x64"), "amd64");
  assert.equal(updaterArch("arm64"), "arm64");
  assert.equal(updaterAssetName("amd64"), "z3cz-host-updater-linux-amd64");
});

test("releaseAssetUrl uses the GitHub download path", () => {
  assert.equal(
    releaseAssetUrl("tukeceshi/z3cz", "v1.2.0", "SHA256SUMS"),
    "https://github.com/tukeceshi/z3cz/releases/download/v1.2.0/SHA256SUMS"
  );
});
