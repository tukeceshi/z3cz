import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  parseAppYml,
  stringifyAppYml,
} from "../../../docker-host/lib/parse-app-yml.mjs";
import { UpdateManager } from "./manager.mjs";

function makeInstall(imageTag = "latest") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "z3cz-updater-"));
  const hostDir = path.join(root, "docker-host");
  fs.mkdirSync(path.join(hostDir, "containers"), { recursive: true });
  fs.writeFileSync(
    path.join(hostDir, "containers", "app.yml"),
    stringifyAppYml({
      hostname: "example.com",
      https: true,
      tls: "auto",
      http_port: 80,
      https_port: 443,
      image_tag: imageTag,
      env: {
        JWT_SECRET: "a".repeat(64),
        SECRET_MASTER_KEY: "b".repeat(64),
      },
    })
  );
  fs.writeFileSync(
    path.join(hostDir, "docker-compose.generated.yml"),
    "name: test\n"
  );
  fs.writeFileSync(path.join(hostDir, ".env.generated"), "JWT_SECRET=a\n");
  return {
    root,
    hostDir,
    installDir: root,
    appYmlPath: path.join(hostDir, "containers", "app.yml"),
    composePath: path.join(hostDir, "docker-compose.generated.yml"),
    envPath: path.join(hostDir, ".env.generated"),
    stateDir: path.join(root, "state"),
    backupDir: path.join(root, "backups"),
    binaryPath: path.join(root, "z3cz-host-updater"),
    selfUpdate: false,
    restartService: () => undefined,
  };
}

test("check marks unofficial current version as upgradable", async () => {
  const paths = makeInstall("latest");
  const manager = new UpdateManager({
    ...paths,
    fetchLatest: async () => ({
      version: "v1.0.0",
      name: "v1.0.0",
      body: "first release",
      url: "https://github.com/tukeceshi/z3cz/releases/tag/v1.0.0",
      publishedAt: new Date().toISOString(),
      prerelease: false,
    }),
    compose: async () => ({ stdout: "", stderr: "" }),
  });
  const status = await manager.check();
  assert.equal(status.operation.phase, "ready");
  assert.equal(status.updateAvailable, true);
  assert.equal(status.latestRelease?.version, "v1.0.0");
  fs.rmSync(paths.root, { recursive: true, force: true });
});

test("missing compose files are reported but do not block start", async () => {
  const paths = makeInstall("latest");
  fs.rmSync(paths.composePath, { force: true });
  fs.rmSync(paths.envPath, { force: true });
  const manager = new UpdateManager({
    ...paths,
    fetchLatest: async () => ({
      version: "v1.0.0",
      name: "v1.0.0",
      body: "",
      url: "",
      publishedAt: new Date().toISOString(),
      prerelease: false,
    }),
    compose: async () => ({ stdout: "", stderr: "" }),
  });
  manager.runUpdate = async () => undefined;
  const status = await manager.check();
  const compose = status.checks.find((check) => check.key === "compose");
  assert.equal(compose?.status, "failed");
  assert.equal(compose?.blocking, false);
  const started = manager.startUpdate("v1.0.0");
  assert.equal(started.operation.phase, "preflight");
  fs.rmSync(paths.root, { recursive: true, force: true });
});

test("startUpdate refuses a version that was not just checked", async () => {
  const paths = makeInstall("1.0.0");
  const manager = new UpdateManager({
    ...paths,
    fetchLatest: async () => ({
      version: "v1.1.0",
      name: "v1.1.0",
      body: "",
      url: "",
      publishedAt: new Date().toISOString(),
      prerelease: false,
    }),
    compose: async () => ({ stdout: "", stderr: "" }),
  });
  await manager.check();
  assert.throws(() => manager.startUpdate("v9.9.9"), /不一致/);
  fs.rmSync(paths.root, { recursive: true, force: true });
});

test("build progress replaces the latest line in the same phase", () => {
  const paths = makeInstall("1.0.0");
  const manager = new UpdateManager({
    ...paths,
    compose: async () => ({ stdout: "", stderr: "" }),
  });
  manager.setPhase("pulling", "构建后端镜像");
  manager.replaceProgress("pulling", "step 1");
  manager.replaceProgress("pulling", "step 2");
  manager.setPhase("pulling", "构建前端镜像");
  manager.replaceProgress("pulling", "step 3");
  assert.deepEqual(
    manager.state.operation.logs.map((entry) => entry.message),
    ["构建后端镜像", "step 2", "构建前端镜像", "step 3"]
  );
  fs.rmSync(paths.root, { recursive: true, force: true });
});

test("writeImageTag updates app.yml", () => {
  const paths = makeInstall("latest");
  const manager = new UpdateManager({
    ...paths,
    compose: async () => ({ stdout: "", stderr: "" }),
  });
  manager.writeImageTag("v1.2.0");
  const config = parseAppYml(fs.readFileSync(paths.appYmlPath, "utf8"));
  assert.equal(config.image_tag, "1.2.0");
  fs.rmSync(paths.root, { recursive: true, force: true });
});

test("interrupted preparation becomes retryable and interrupted switching requires recovery", (t) => {
  const paths = makeInstall("1.0.0");
  t.after(() => fs.rmSync(paths.root, { recursive: true, force: true }));
  const manager = new UpdateManager(paths);
  manager.state.operation.phase = "pulling";
  manager.recoverInterruptedOperation();
  assert.equal(manager.state.operation.phase, "failed");
  manager.state.pendingUpdate = { version: "v1.0.0", migrationStarted: false };
  manager.state.operation.phase = "switching";
  manager.writeImageTag("v1.1.0");
  manager.recoverInterruptedOperation();
  assert.equal(manager.state.operation.phase, "manual_intervention");
  assert.equal(manager.snapshot().currentVersion, "v1.0.0");
  assert.equal(manager.snapshot().rollbackRequiresRestore, false);
  assert.throws(() => manager.startUpdate("v1.1.0"), /先恢复/);
});

test("stale and failed checks cannot authorize update", async (t) => {
  const paths = makeInstall("1.9.0");
  t.after(() => fs.rmSync(paths.root, { recursive: true, force: true }));
  let fail = false;
  const manager = new UpdateManager({
    ...paths,
    fetchLatest: async () => {
      if (fail) throw new Error("network unavailable");
      return { version: "v1.10.0" };
    },
  });
  assert.equal((await manager.check()).updateAvailable, true);
  assert.equal(manager.snapshot().stale, false);
  manager.state.checkedAt = "2000-01-01T00:00:00Z";
  assert.equal(manager.snapshot().stale, true);
  assert.throws(() => manager.startUpdate("v1.10.0"), /重新检查/);
  fail = true;
  await assert.rejects(manager.check(), /network unavailable/);
  assert.equal(manager.snapshot().checkError, "network unavailable");
  assert.equal(manager.snapshot().latestRelease.version, "v1.10.0");
});

test("concurrent check and update requests are refused", async (t) => {
  const paths = makeInstall("1.0.0");
  t.after(() => fs.rmSync(paths.root, { recursive: true, force: true }));
  const manager = new UpdateManager(paths);
  manager.state.operation.phase = "checking";
  manager.state.checkedAt = new Date().toISOString();
  await assert.rejects(manager.check(), /正在进行/);
  assert.throws(() => manager.startUpdate("v1.1.0"), /正在进行/);
});

test("recovery never changes an operation owned by a live process", (t) => {
  const paths = makeInstall("1.0.0");
  t.after(() => fs.rmSync(paths.root, { recursive: true, force: true }));
  const manager = new UpdateManager(paths);
  manager.state.operation.phase = "switching";
  manager.state.pendingUpdate = { version: "v1.0.0" };
  fs.writeFileSync(
    path.join(paths.stateDir, "operation.lock"),
    String(process.pid)
  );
  manager.recoverInterruptedOperation();
  assert.equal(manager.state.operation.phase, "switching");
});

function linkRelease(target, linkPath) {
  fs.symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
}

function releaseLayout(root, options) {
  const currentRelease = path.join(root, "releases", "1.1.0");
  const previousRelease = path.join(root, "releases", "1.0.0");
  fs.mkdirSync(path.join(currentRelease, "scripts"), { recursive: true });
  fs.mkdirSync(previousRelease, { recursive: true });
  fs.writeFileSync(path.join(currentRelease, "VERSION"), "v1.1.0\n");
  fs.writeFileSync(path.join(previousRelease, "VERSION"), "v1.0.0\n");
  fs.writeFileSync(path.join(currentRelease, "scripts", "rollback.sh"), "#!/bin/sh\n");
  linkRelease(currentRelease, path.join(root, "current"));
  if (options.distinctPrevious !== false) {
    linkRelease(previousRelease, path.join(root, "previous"));
  } else {
    linkRelease(currentRelease, path.join(root, "previous"));
  }
  return { currentRelease, previousRelease };
}

test("a finished release update can roll back from the previous link", (t) => {
  const paths = makeInstall("1.1.0");
  t.after(() => fs.rmSync(paths.root, { recursive: true, force: true }));
  const { previousRelease } = releaseLayout(paths.installDir, {});
  fs.mkdirSync(paths.stateDir, { recursive: true });
  const backupDir = path.join(paths.root, "host-backups");
  fs.mkdirSync(backupDir);
  const dump = path.join(backupDir, "z3cz-before-1.0.0-20260101010101.dump");
  fs.writeFileSync(dump, "dump");
  fs.writeFileSync(
    path.join(paths.stateDir, "release-rollback.json"),
    JSON.stringify({
      fromVersion: "v1.0.0",
      previous: fs.realpathSync(previousRelease),
      backupPath: dump,
      backupChecksum: `sha256:${"a".repeat(64)}`,
      backupBytes: 4,
      createdAt: "2026-01-01T01:01:01.000Z",
      rollbackCompatible: true,
    })
  );
  const calls = [];
  const manager = new UpdateManager({
    ...paths,
    releaseBackupDir: backupDir,
    spawn(command, args) {
      calls.push({ command, args });
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      process.nextTick(() => child.emit("exit", 0));
      return child;
    },
  });
  const status = manager.snapshot();
  assert.equal(status.rollbackVersion, "v1.0.0");
  assert.equal(status.rollbackRequiresRestore, false);
  assert.equal(status.lastBackup?.id, "z3cz-before-1.0.0-20260101010101");
  const started = manager.startRollback("界面异常");
  assert.equal(started.operation.phase, "rolling_back");
  assert.equal(started.operation.targetVersion, "v1.0.0");
  assert.equal(calls[0].command, "bash");
  assert.deepEqual(calls[0].args, [
    path.join(paths.installDir, "current", "scripts", "rollback.sh"),
  ]);
  return new Promise((resolve) => {
    setImmediate(() => {
      assert.equal(manager.state.operation.phase, "rolled_back");
      resolve();
    });
  });
});

test("an incompatible release rollback restores the recorded dump", (t) => {
  const paths = makeInstall("1.1.0");
  t.after(() => fs.rmSync(paths.root, { recursive: true, force: true }));
  const { previousRelease } = releaseLayout(paths.installDir, {});
  fs.mkdirSync(paths.stateDir, { recursive: true });
  const dump = path.join(paths.root, "before.dump");
  fs.writeFileSync(dump, "dump");
  fs.writeFileSync(
    path.join(paths.stateDir, "release-rollback.json"),
    JSON.stringify({
      fromVersion: "v1.0.0",
      previous: fs.realpathSync(previousRelease),
      backupPath: dump,
      backupChecksum: `sha256:${"b".repeat(64)}`,
      backupBytes: 4,
      createdAt: "2026-01-01T01:01:01.000Z",
      rollbackCompatible: false,
    })
  );
  const calls = [];
  const manager = new UpdateManager({
    ...paths,
    spawn(_command, args) {
      calls.push(args);
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      process.nextTick(() => child.emit("exit", 0));
      return child;
    },
  });
  assert.equal(manager.snapshot().rollbackRequiresRestore, true);
  manager.startRollback("数据不兼容");
  assert.deepEqual(calls[0].slice(-2), ["--restore", dump]);
  return new Promise((resolve) => setImmediate(resolve));
});

test("a previous link without a rollback record still offers code rollback", (t) => {
  const paths = makeInstall("1.1.0");
  t.after(() => fs.rmSync(paths.root, { recursive: true, force: true }));
  releaseLayout(paths.installDir, {});
  const backupDir = path.join(paths.root, "host-backups");
  fs.mkdirSync(backupDir);
  fs.writeFileSync(path.join(backupDir, "z3cz-before-1.0.0-1.dump"), "old");
  const manager = new UpdateManager({ ...paths, releaseBackupDir: backupDir });
  const status = manager.snapshot();
  assert.equal(status.rollbackVersion, "v1.0.0");
  assert.equal(status.rollbackRequiresRestore, false);
  assert.equal(status.lastBackup?.version, "v1.0.0");
});

test("the same directory linked as previous cannot be rolled back", (t) => {
  const paths = makeInstall("1.1.0");
  t.after(() => fs.rmSync(paths.root, { recursive: true, force: true }));
  releaseLayout(paths.installDir, { distinctPrevious: false });
  const manager = new UpdateManager(paths);
  assert.equal(manager.snapshot().rollbackVersion, undefined);
  assert.throws(() => manager.startRollback("没有目标"), /没有可用的回退版本/);
});
