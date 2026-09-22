#!/usr/bin/env node
/**
 * Start the default dev stack, whose Caddy gateway owns :3000.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync(
  "docker",
  ["compose", "up", "-d", "--build", "--wait"],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  }
);

if (result.status === 0) {
  console.log("");
  console.log("Development stack: http://localhost:3000");
}

process.exit(result.status ?? 1);
