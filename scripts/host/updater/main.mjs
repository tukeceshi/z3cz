#!/usr/bin/env node

import { UpdateManager } from "./manager.mjs";
import { defaultSocketPath } from "./paths.mjs";
import { createUpdaterServer, listenUnix } from "./server.mjs";
import fs from "node:fs";
import path from "node:path";
import { validateSourceRef } from "./source-release.mjs";

const token = String(process.env.Z3CZ_UPDATER_TOKEN || "").trim();
const command = process.argv[2] || "serve";

async function main() {
  const manager = new UpdateManager();
  if (command === "install-source") {
    const ref = process.argv[3] || fs.readFileSync(path.join(manager.installDir, "SOURCE_REVISION"), "utf8").trim();
    validateSourceRef(ref);
    const version = fs.readFileSync(path.join(manager.installDir, "VERSION"), "utf8").trim();
    manager.state.operation = { phase: "preflight", logs: [], automaticRollback: false };
    await manager.runUpdate(manager.currentVersion(), version, ref);
    console.log(JSON.stringify(manager.snapshot(), null, 2));
    if (manager.state.operation.phase !== "succeeded") process.exitCode = 1;
    return;
  }
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
    if (finalStatus.operation.phase !== "succeeded") {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "rollback") {
    const status = manager.startRollback(process.argv[3] || "cli");
    console.log(JSON.stringify(status, null, 2));
    await waitUntilIdle(manager);
    console.log(JSON.stringify(manager.snapshot(), null, 2));
    if (manager.state.operation.phase !== "rolled_back") process.exitCode = 1;
    return;
  }
  if (command !== "serve") {
    console.error("Usage: updater serve|status|check|update [version]|rollback [reason]");
    process.exitCode = 1;
    return;
  }
  const socket = process.env.Z3CZ_UPDATER_SOCKET || defaultSocketPath;
  if (fs.existsSync(path.join(manager.stateDir, "operation.lock"))) {
    const pid = Number(fs.readFileSync(path.join(manager.stateDir, "operation.lock"), "utf8"));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error("更新锁损坏，请人工检查");
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
      manager.state.operation.phase = "manual_intervention";
      manager.state.operation.error = "更新进程中断，请检查维护状态和备份后恢复；不要重复执行迁移";
      manager.saveState();
    }
  }
  if (manager.state.pendingUpdate) {
    manager.state.operation.phase = "manual_intervention";
    manager.state.operation.error = "上次切换未完成，请检查日志；可使用回退恢复上次部署";
    manager.saveState();
  }
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
