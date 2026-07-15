#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const monorepoRoot = path.resolve(apiRoot, "..", "..");

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return "";
  }
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function getCacheDir() {
  return (
    process.env.API_BOOT_CACHE_DIR ??
    (fs.existsSync("/.dockerenv")
      ? "/app/data/storage/cache"
      : path.join(apiRoot, ".cache", "boot"))
  );
}

const cacheDir = getCacheDir();
fs.mkdirSync(cacheDir, { recursive: true });

const stamp = {
  lockHash: hashFile(path.join(monorepoRoot, "pnpm-lock.yaml")),
  migrationJournalHash: hashFile(
    path.join(apiRoot, "src/db/migrations/meta/_journal.json")
  ),
  initializedAt: new Date().toISOString(),
};

const stampPath = path.join(cacheDir, "api-boot.json");
fs.writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`, "utf8");
console.log(`[api:stamp] Wrote boot stamp to ${stampPath}`);
