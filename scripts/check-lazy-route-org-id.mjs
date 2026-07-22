#!/usr/bin/env node
/**
 * Lazy-mounted org routes receive organizationId via context (c.get), not
 * c.req.param("organizationId") — the param is not on the sub-app mount path.
 *
 * Run: node scripts/check-lazy-route-org-id.mjs
 */

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const routesDir = path.join(repoRoot, "apps/api/src/routes");

const FORBIDDEN = 'c.req.param("organizationId")';

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
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      walk(relativePath, onFile);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    onFile(relativePath, fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
  }
}

function main() {
  walk("apps/api/src/routes", (file, content) => {
    assert(
      !content.includes(FORBIDDEN),
      `${file} uses c.get("organizationId") instead of ${FORBIDDEN}`
    );
  });

  if (process.exitCode === 1) {
    console.error(
      "\nUse c.get(\"organizationId\") in route handlers; lazy mounts forward org via x-dafthunk-organization-id."
    );
    process.exit(1);
  }

  console.log("Lazy route organizationId checks passed.");
}

main();
