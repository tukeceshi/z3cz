#!/usr/bin/env node
/**
 * Cross-platform tsx watch entry for API dev:
 * - polling for Docker bind mounts (Windows host → Linux container)
 * - skip migrate on tsx restarts when boot stamp matches (see api-boot-cache)
 */
import { spawn } from "node:child_process";
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

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
