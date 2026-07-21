#!/usr/bin/env node
/**
 * Mainline must not reference archived legacy workflow nodes.
 * Run: node scripts/check-mainline-core-only.mjs
 */

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const FORBIDDEN = [
  "@dafthunk/runtime-legacy",
  "ENABLE_LEGACY_NODES",
  "VITE_ENABLE_LEGACY_NODES",
  "register-legacy-widgets",
  "ensureLegacyWidgetsLoaded",
];

const SCAN_ROOTS = [
  "apps/api/src",
  "apps/app/src",
  "packages/runtime/src",
  "packages/types/src",
];

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`OK: ${message}`);
  return true;
}

function walk(relativeDir, onFile) {
  const dir = path.join(repoRoot, relativeDir);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      walk(relativePath, onFile);
      continue;
    }
    if (!/\.(ts|tsx|jsonc)$/.test(entry.name)) continue;
    onFile(relativePath, fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
  }
}

function main() {
  for (const root of SCAN_ROOTS) {
    walk(root, (file, content) => {
      for (const token of FORBIDDEN) {
        assert(
          !content.includes(token),
          `${file} does not reference '${token}'`
        );
      }
    });
  }

  assert(
    fs.existsSync(path.join(repoRoot, "archive/runtime-legacy")),
    "legacy package archived under archive/runtime-legacy"
  );

  assert(
    !fs.existsSync(path.join(repoRoot, "packages/runtime-legacy")),
    "packages/runtime-legacy removed from workspace"
  );

  const coreRegistry = fs.readFileSync(
    path.join(repoRoot, "apps/api/src/runtime/cloudflare-node-registry.ts"),
    "utf8"
  );
  assert(
    coreRegistry.includes("AiTextNode") &&
      coreRegistry.includes("AiImageNode") &&
      coreRegistry.includes("AiVideoNode") &&
      !coreRegistry.includes("registerLegacy"),
    "core registry registers only generative nodes"
  );

  if (process.exitCode === 1) {
    process.exit(1);
  }

  console.log("Mainline core-only checks passed.");
}

main();
