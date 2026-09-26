#!/usr/bin/env node
/**
 * Cross-platform tsx watch entry for API dev:
 * - polling for Docker bind mounts (Windows host → Linux container)
 * - skip migrate on tsx restarts when boot stamp matches (see api-boot-cache)
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

process.env.CHOKIDAR_USEPOLLING ??= "1";
process.env.CHOKIDAR_INTERVAL ??= "300";

// tsx watch restarts the Node process only — entrypoint fast mode is not re-run.
// Stamp-guarded skip keeps routine restarts fast; FORCE_DB_MIGRATE=1 overrides.
if (process.env.FORCE_DB_MIGRATE !== "1") {
  process.env.SKIP_DB_MIGRATE ??= "1";
}

// tsx watch stays alive after the application exits. In Docker, forward a
// fatal bootstrap failure to the container so its restart policy can act.
const failureDir =
  process.env.DAFTHUNK_SERVICE === "api"
    ? mkdtempSync(join(tmpdir(), "dafthunk-api-"))
    : undefined;
if (failureDir) {
  process.env.API_STARTUP_FAILURE_FILE = join(failureDir, "failed");
  process.on("exit", () =>
    rmSync(failureDir, { recursive: true, force: true })
  );
}

const child = spawn(
  "pnpm",
  [
    "exec",
    "tsx",
    "watch",
    "--import",
    "./src/shims/cloudflare-register.mjs",
    "src/server.ts",
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
    cwd: apiRoot,
  }
);

if (failureDir) {
  setInterval(() => {
    if (existsSync(process.env.API_STARTUP_FAILURE_FILE)) {
      console.error("[api] Fatal bootstrap failure; restarting container.");
      child.kill("SIGTERM");
      process.exit(1);
    }
  }, 1000).unref();
}

child.on("error", (error) => {
  console.error("[api] Unable to start watcher:", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
