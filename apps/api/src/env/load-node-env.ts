import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

function parseDevVars(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function isRunningInDocker(): boolean {
  return process.env.CI === "true" || fs.existsSync("/.dockerenv");
}

function resolveLocalStoragePath(pathValue: string | undefined): string {
  const defaultPath = isRunningInDocker()
    ? "/app/data/storage"
    : path.join(apiRoot, "data", "storage");

  if (!pathValue) {
    return defaultPath;
  }

  if (isRunningInDocker()) {
    if (/^[a-zA-Z]:[\\/]/.test(pathValue) || pathValue.includes("PORT=")) {
      return "/app/data/storage";
    }
    if (!pathValue.startsWith("/")) {
      return "/app/data/storage";
    }
  }

  return pathValue;
}

function resolveDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) {
    return url;
  }

  if (
    isRunningInDocker() &&
    /@(localhost|127\.0\.0\.1):5432/.test(url)
  ) {
    return url.replace(
      /@(localhost|127\.0\.0\.1):5432/,
      "@supabase-db:5432"
    );
  }

  return url;
}

export function loadNodeEnv(): Record<string, string> {
  const devVarsPath = path.join(apiRoot, ".dev.vars");
  const fromFile = fs.existsSync(devVarsPath)
    ? parseDevVars(fs.readFileSync(devVarsPath, "utf8"))
    : {};

  const merged: Record<string, string> = { ...fromFile };
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  if (merged.DATABASE_URL) {
    merged.DATABASE_URL = resolveDatabaseUrl(merged.DATABASE_URL) ?? merged.DATABASE_URL;
  }

  merged.LOCAL_STORAGE_PATH = resolveLocalStoragePath(merged.LOCAL_STORAGE_PATH);

  return merged;
}

export function getApiRootPath(): string {
  return apiRoot;
}
