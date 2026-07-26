#!/usr/bin/env node
/**
 * Prefer bash Discourse-style CLIs; fall back to .mjs when bash is unavailable (e.g. some Windows setups).
 *
 * Usage:
 *   node docker-host/invoke-host.mjs setup
 *   node docker-host/invoke-host.mjs launcher rebuild
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hostDir = path.dirname(fileURLToPath(import.meta.url));
const kind = process.argv[2];
const rest = process.argv.slice(3);

if (kind !== "setup" && kind !== "launcher") {
  console.error("Usage: node docker-host/invoke-host.mjs setup|launcher [...args]");
  process.exit(1);
}

const bashScript = path.join(
  hostDir,
  kind === "setup" ? "dafthunk-setup" : "launcher"
);
const nodeScript = path.join(
  hostDir,
  kind === "setup" ? "dafthunk-setup.mjs" : "launcher.mjs"
);

function run(command, args) {
  return spawnSync(command, args, {
    stdio: "inherit",
    cwd: hostDir,
    shell: process.platform === "win32",
  });
}

const bashResult = run("bash", [bashScript, ...rest]);
if (!bashResult.error) {
  process.exit(bashResult.status ?? 1);
}

const nodeResult = run(process.execPath, [nodeScript, ...rest]);
if (nodeResult.error) {
  console.error(nodeResult.error.message);
  console.error("Install bash (Git Bash / WSL) or Node to run host setup/launcher.");
  process.exit(1);
}
process.exit(nodeResult.status ?? 1);
