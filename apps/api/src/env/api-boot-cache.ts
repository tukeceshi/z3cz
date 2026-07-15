import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getApiRootPath } from "./api-root";
import { isRunningInDocker } from "./startup-secrets";

export interface ApiBootStamp {
  readonly lockHash: string;
  readonly migrationJournalHash: string;
  readonly initializedAt: string;
}

export function getApiBootCacheDir(): string {
  if (process.env.API_BOOT_CACHE_DIR) {
    return path.resolve(process.env.API_BOOT_CACHE_DIR);
  }
  if (isRunningInDocker()) {
    return "/app/data/storage/cache";
  }
  return path.resolve(getApiRootPath(), ".cache", "boot");
}

export function getMonorepoRootPath(): string {
  return path.resolve(getApiRootPath(), "..", "..");
}

function stampPath(): string {
  return path.join(getApiBootCacheDir(), "api-boot.json");
}

function phasePath(): string {
  return path.join(getApiBootCacheDir(), "boot-phase.txt");
}

function ensureCacheDir(): void {
  fs.mkdirSync(getApiBootCacheDir(), { recursive: true });
}

export function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return "";
  }
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

export function getLockfileHash(): string {
  return hashFile(path.join(getMonorepoRootPath(), "pnpm-lock.yaml"));
}

export function getMigrationJournalHash(): string {
  return hashFile(
    path.join(getApiRootPath(), "src/db/migrations/meta/_journal.json")
  );
}

export function readBootStamp(): ApiBootStamp | null {
  const filePath = stampPath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as ApiBootStamp;
  } catch {
    return null;
  }
}

export function writeBootStamp(partial?: Partial<ApiBootStamp>): ApiBootStamp {
  ensureCacheDir();
  const existing = readBootStamp();
  const stamp: ApiBootStamp = {
    lockHash: partial?.lockHash ?? existing?.lockHash ?? getLockfileHash(),
    migrationJournalHash:
      partial?.migrationJournalHash ??
      existing?.migrationJournalHash ??
      getMigrationJournalHash(),
    initializedAt: partial?.initializedAt ?? new Date().toISOString(),
  };
  fs.writeFileSync(stampPath(), `${JSON.stringify(stamp, null, 2)}\n`, "utf8");
  return stamp;
}

export function isBootStampCurrent(stamp: ApiBootStamp | null): boolean {
  if (!stamp) {
    return false;
  }
  return (
    stamp.lockHash === getLockfileHash() &&
    stamp.migrationJournalHash === getMigrationJournalHash()
  );
}

export function writeBootPhase(phase: string): void {
  ensureCacheDir();
  fs.writeFileSync(phasePath(), `${phase}\n`, "utf8");
}

export function readBootPhase(): string | null {
  const filePath = phasePath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const value = fs.readFileSync(filePath, "utf8").trim();
  return value.length > 0 ? value : null;
}

export function shouldSkipDatabaseMigrations(): boolean {
  if (process.env.FORCE_DB_MIGRATE === "1") {
    return false;
  }
  if (process.env.SKIP_DB_MIGRATE !== "1") {
    return false;
  }
  const stamp = readBootStamp();
  if (stamp?.migrationJournalHash === getMigrationJournalHash()) {
    console.log("[api] Skipping database migrations (boot stamp matches journal).");
    return true;
  }
  console.log(
    "[api] Migration journal changed since boot stamp — running migrations."
  );
  return false;
}
