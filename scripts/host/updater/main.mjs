#!/usr/bin/env node

import { UpdateManager } from "./manager.mjs";
import { defaultSocketPath } from "./paths.mjs";
import { createUpdaterServer, listenUnix } from "./server.mjs";

const token = String(process.env.Z3CZ_UPDATER_TOKEN || "").trim();
const command = process.argv[2] || "serve";

async function main() {
  const manager = new UpdateManager();
  if (command === "status") {
    console.log(JSON.stringify(manager.snapshot(), null, 2));
    return;
  }
  if (command === "check") {
    console.log(JSON.stringify(await manager.check(), null, 2));
    return;
  }
  if (command === "update") {
    const target = process.argv[3];
    await manager.check();
    const status = manager.startUpdate(
      target || manager.snapshot().latestRelease?.version || ""
    );
    console.log(JSON.stringify(status, null, 2));
    await waitUntilIdle(manager);
    const finalStatus = manager.snapshot();
    console.log(JSON.stringify(finalStatus, null, 2));
    if (
      finalStatus.operation.phase !== "succeeded" &&
      finalStatus.operation.phase !== "rolled_back"
    ) {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "rollback") {
    const status = manager.startRollback(process.argv[3] || "cli");
    console.log(JSON.stringify(status, null, 2));
    await waitUntilIdle(manager);
    console.log(JSON.stringify(manager.snapshot(), null, 2));
    return;
  }
  if (command !== "serve") {
    console.error("Usage: updater serve|status|check|update [version]|rollback [reason]");
    process.exitCode = 1;
    return;
  }
  const socket = process.env.Z3CZ_UPDATER_SOCKET || defaultSocketPath;
  const server = createUpdaterServer(manager, token);
  await listenUnix(socket, server);
  console.log(`z3cz host updater listening on ${socket}`);
}

async function waitUntilIdle(manager) {
  const active = new Set([
    "preflight",
    "backing_up",
    "pulling",
    "draining",
    "migrating",
    "switching",
    "verifying",
    "rolling_back",
  ]);
  while (active.has(manager.snapshot().operation.phase)) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
