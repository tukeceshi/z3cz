#!/usr/bin/env node
/**
 * Start the optional dev Caddy gateway on :8080 (same-origin /api + WS).
 * Does not replace classic :3101 development.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync(
  "docker",
  ["compose", "--profile", "gateway", "up", "-d", "--build", "--wait"],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      VITE_WS_VIA_PROXY: "1",
    },
  }
);

if (result.status === 0) {
  console.log("");
  console.log("Dev gateway: http://localhost:8080");
  console.log("Use this origin only (do not mix cookies with http://localhost:3101).");
}

process.exit(result.status ?? 1);
