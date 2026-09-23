import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { getApiBootCacheDir, writeBootPhase } from "./api-boot-cache";

const envKeys = [
  "API_BOOT_CACHE_DIR",
  "LOCAL_STORAGE_PATH",
  "RUNTIME",
  "CI",
] as const;

describe("api boot cache", () => {
  const previous: Partial<Record<(typeof envKeys)[number], string>> = {};

  afterEach(() => {
    for (const key of envKeys) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  function rememberEnv(): void {
    for (const key of envKeys) {
      previous[key] = process.env[key];
    }
  }

  it("uses the writable storage volume when the release mount is read-only", () => {
    rememberEnv();
    delete process.env.API_BOOT_CACHE_DIR;
    delete process.env.CI;
    process.env.RUNTIME = "docker";
    process.env.LOCAL_STORAGE_PATH = "/var/lib/z3cz/uploads";

    expect(getApiBootCacheDir()).toBe("/var/lib/z3cz/uploads/cache");
  });

  it("keeps an explicit cache directory", () => {
    rememberEnv();
    delete process.env.CI;
    process.env.RUNTIME = "docker";
    process.env.LOCAL_STORAGE_PATH = "/var/lib/z3cz/uploads";
    process.env.API_BOOT_CACHE_DIR = "/var/lib/z3cz/uploads/cache";

    expect(getApiBootCacheDir()).toBe(
      path.resolve("/var/lib/z3cz/uploads/cache")
    );
  });

  it("does not crash startup when the cache directory cannot be created", () => {
    rememberEnv();
    const blocker = `/tmp/z3cz-boot-blocker-${Date.now()}`;
    fs.writeFileSync(pathToFileURL(blocker), "x");
    process.env.API_BOOT_CACHE_DIR = blocker;

    expect(() => writeBootPhase("validating_config")).not.toThrow();

    fs.unlinkSync(pathToFileURL(blocker));
  });
});
