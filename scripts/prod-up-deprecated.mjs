#!/usr/bin/env node
/**
 * Legacy prod:up — prints deprecation and offers docker-host path.
 * Set ALLOW_LEGACY_PROD=1 to still run docker-compose.prod.yml.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.error(`
[deprecated] pnpm prod:up / docker-compose.prod.yml

Prefer Discourse-style self-host:
  pnpm host:setup
  pnpm host:rebuild

Legacy stack (www + multi-port, no Caddy) still available with:
  ALLOW_LEGACY_PROD=1 pnpm prod:up
`);

if (process.env.ALLOW_LEGACY_PROD !== "1") {
  process.exit(1);
}

const envFile = path.join(root, ".env.docker.prod");
if (!fs.existsSync(envFile)) {
  console.error("Missing .env.docker.prod — copy from .env.docker.prod.example first.");
  process.exit(1);
}

const result = spawnSync(
  "docker",
  [
    "compose",
    "-f",
    "docker-compose.prod.yml",
    "--env-file",
    ".env.docker.prod",
    "up",
    "-d",
    "--build",
  ],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  }
);

process.exit(result.status ?? 1);
