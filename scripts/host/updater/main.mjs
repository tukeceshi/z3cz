#!/usr/bin/env node

import { UpdateManager } from "./manager.mjs";
import { defaultSocketPath } from "./paths.mjs";
import { createUpdaterServer, listenUnix } from "./server.mjs";
import { readUpdatePolicy } from "./update-policy.mjs";
import { compareVersions, isReleaseVersion } from "./version.mjs";

const token = String(process.env.Z3CZ_UPDATER_TOKEN || "").trim();
const command = process.argv[2] || "serve";

async function main() {
  if (command === "validate-policy") {
    const [sourceDir, currentVersion] = process.argv.slice(3);
    if (!sourceDir || !currentVersion) throw new Error("缺少版本策略参数");
    const policy = readUpdatePolicy(sourceDir);
    if (!policy || policy.format !== 2)
      throw new Error("发布包缺少有效的更新策略");
    if (
      compareVersions(currentVersion, policy.minimumVersion) < 0 &&
      policy.minimumVersion !== "v0.0.0"
    ) {
      throw new Error(
        `当前版本 ${currentVersion} 低于最低可升级版本 ${policy.minimumVersion}`
      );
    }
    const rollbackCompatible =
      policy.rollbackCompatible &&
      isReleaseVersion(currentVersion) &&
      compareVersions(currentVersion, policy.minimumRollbackVersion) >= 0;
    process.stdout.write(rollbackCompatible ? "true\n" : "false\n");
    return;
  }
  const manager = new UpdateManager();
  manager.recoverInterruptedOperation();
  if (command === "status") {
    console.log(JSON.stringify(manager.snapshot(), null, 2));
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
    console.error(
      "Usage: updater serve|status|rollback [reason]|validate-policy <release-dir> <current-version>"
    );
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
