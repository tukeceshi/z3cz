import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { UpdateManager } from "./manager.mjs";
import { acquireUpdateLock, captureDeployment } from "./source-update.mjs";
import {
  cleanupReleases,
  GITEE_SOURCE_REMOTE,
  runtimeImage,
  sourceRemote,
  validateSourceRef,
} from "./source-release.mjs";
import { planSourceUpdate } from "./update-policy.mjs";

const IMAGE = `sha256:${"a".repeat(64)}`;
const OLD_FINGERPRINT = "1".repeat(64);
const NEW_FINGERPRINT = "2".repeat(64);

function policy(overrides = {}) {
  return {
    format: 2,
    minimumVersion: "v0.0.0",
    minimumRollbackVersion: "v0.0.0",
    requiresBackup: false,
    databaseChanges: false,
    rollbackCompatible: true,
    ...overrides,
  };
}

function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-update-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const hostDir = path.join(root, "docker-host");
  fs.mkdirSync(path.join(hostDir, "containers"), { recursive: true });
  fs.mkdirSync(path.join(hostDir, "shared/storage"), { recursive: true });
  fs.writeFileSync(
    path.join(hostDir, "containers/app.yml"),
    "hostname: example.com\nimage_tag: 1.0.0\nenv:\n  JWT_SECRET: test\n  SECRET_MASTER_KEY: test\n"
  );
  fs.writeFileSync(
    path.join(hostDir, "docker-compose.generated.yml"),
    "old-compose"
  );
  fs.writeFileSync(path.join(hostDir, ".env.generated"), "old-env");
  fs.writeFileSync(path.join(hostDir, "Caddyfile.generated"), "old-caddy");
  fs.writeFileSync(
    path.join(hostDir, "source-deployment.json"),
    JSON.stringify({ kind: "image", databaseFingerprint: OLD_FINGERPRINT })
  );
  const events = [];
  const source = {
    kind: "image",
    commit: "b".repeat(40),
    version: "v1.1.0",
    runtimeImage: IMAGE,
    appImage: IMAGE,
    databaseFingerprint: options.fingerprint || OLD_FINGERPRINT,
    updatePolicy: policy(options.policy),
  };
  const manager = new UpdateManager({
    hostDir,
    installDir: root,
    appYmlPath: path.join(hostDir, "containers/app.yml"),
    composePath: path.join(hostDir, "docker-compose.generated.yml"),
    envPath: path.join(hostDir, ".env.generated"),
    stateDir: path.join(root, "state"),
    backupDir: path.join(root, "backups"),
    storageDir: path.join(hostDir, "shared/storage"),
    backupMaxAgeMs: 60_000,
    prepareSource: async () => {
      events.push("build");
      if (options.fail === "build") throw new Error("build failed");
      return source;
    },
    reusableBackup: async (backup, fingerprint) =>
      Boolean(backup?.verified && backup.databaseFingerprint === fingerprint),
    createBackup: async () => {
      events.push("backup");
      if (options.fail === "backup") throw new Error("backup failed");
      return { id: "this-update", createdAt: new Date().toISOString() };
    },
    restoreBackup: async ({ backup }) => {
      events.push("restore");
      assert.equal(backup.id, "this-update");
    },
    runCommand: async (_cwd, _cmd, args) => ({
      stdout: args[0] === "inspect" ? IMAGE : "",
      stderr: "",
    }),
    compose: async (args) => {
      const event = args.join(" ");
      events.push(event);
      if (args[0] === "ps") return { stdout: "old-container", stderr: "" };
      if (args.includes("json")) {
        return {
          stdout: JSON.stringify({
            services: { api: { image: "old" }, app: { image: "old" } },
          }),
          stderr: "",
        };
      }
      if (args.includes("db:migrate") && options.fail === "migration") {
        throw new Error("migration failed");
      }
      return { stdout: "", stderr: "" };
    },
  });
  manager.verifyHealth = async (version) => {
    events.push(`health ${version}`);
    if (options.fail === "health" && version === "v1.1.0") {
      throw new Error("new service unhealthy");
    }
    assert.ok(fs.existsSync(path.join(hostDir, "shared/maintenance/enabled")));
  };
  return { manager, events, hostDir };
}

function reusableBackup() {
  return {
    id: "recent",
    verified: true,
    createdAt: new Date().toISOString(),
    databaseFingerprint: OLD_FINGERPRINT,
  };
}

test("ordinary update reuses a verified backup and rolls code back without restoring data", async (t) => {
  const { manager, events } = fixture(t);
  manager.state.lastBackup = reusableBackup();
  await manager.runUpdate("v1.0.0", "v1.1.0");
  assert.equal(manager.state.operation.phase, "succeeded");
  assert.equal(manager.state.operation.mode, "light");
  assert.ok(!events.includes("backup"));
  assert.ok(!events.some((event) => event.includes("db:migrate")));
  assert.equal(manager.snapshot().rollbackRequiresRestore, false);
  await manager.runRollback("v1.0.0", undefined, false);
  assert.equal(manager.state.operation.phase, "rolled_back");
  assert.ok(!events.includes("restore"));
});

test("missing reusable backup creates one after stopping the old app", async (t) => {
  const { manager, events } = fixture(t);
  await manager.runUpdate("v1.0.0", "v1.1.0");
  assert.equal(manager.state.operation.phase, "succeeded");
  assert.ok(events.indexOf("build") < events.indexOf("stop api app"));
  assert.ok(events.indexOf("stop api app") < events.indexOf("backup"));
  assert.equal(manager.state.lastBackup.databaseFingerprint, OLD_FINGERPRINT);
});

test("ordinary health failure automatically restores old code", async (t) => {
  const { manager, events } = fixture(t, { fail: "health" });
  manager.state.lastBackup = reusableBackup();
  await manager.runUpdate("v1.0.0", "v1.1.0");
  assert.equal(manager.state.operation.phase, "rolled_back");
  assert.equal(manager.state.operation.automaticRollback, true);
  assert.ok(!events.includes("restore"));
  assert.equal(manager.currentVersion(), "v1.0.0");
});

test("incompatible migration failure stays in maintenance for explicit recovery", async (t) => {
  const { manager, events, hostDir } = fixture(t, {
    fingerprint: NEW_FINGERPRINT,
    policy: { rollbackCompatible: false, requiresBackup: true },
    fail: "migration",
  });
  await manager.runUpdate("v1.0.0", "v1.1.0");
  assert.equal(manager.state.operation.phase, "manual_intervention");
  assert.ok(fs.existsSync(path.join(hostDir, "shared/maintenance/enabled")));
  assert.ok(!events.includes("restore"));
  assert.equal(manager.snapshot().rollbackRequiresRestore, true);
  await manager.runRollback("v1.0.0", undefined, false);
  assert.equal(manager.state.operation.phase, "rolled_back");
  assert.ok(events.includes("restore"));
});

test("compatible migration can automatically roll code back without restoring data", async (t) => {
  const { manager, events, hostDir } = fixture(t, {
    fingerprint: NEW_FINGERPRINT,
    policy: { databaseChanges: true, rollbackCompatible: true },
    fail: "health",
  });
  manager.state.lastBackup = reusableBackup();
  await manager.runUpdate("v1.0.0", "v1.1.0");
  assert.equal(manager.state.operation.phase, "rolled_back");
  assert.ok(!events.includes("restore"));
  const deployment = JSON.parse(
    fs.readFileSync(path.join(hostDir, "source-deployment.json"), "utf8")
  );
  assert.equal(deployment.databaseFingerprint, NEW_FINGERPRINT);
});

test("later code rollback remembers a compatible migrated database", async (t) => {
  const { manager, events, hostDir } = fixture(t, {
    fingerprint: NEW_FINGERPRINT,
    policy: { databaseChanges: true, rollbackCompatible: true },
  });
  manager.state.lastBackup = reusableBackup();
  await manager.runUpdate("v1.0.0", "v1.1.0");
  assert.equal(manager.state.operation.phase, "succeeded");
  await manager.runRollback("v1.0.0", undefined, false);
  assert.equal(manager.state.operation.phase, "rolled_back");
  assert.ok(!events.includes("restore"));
  const deployment = JSON.parse(
    fs.readFileSync(path.join(hostDir, "source-deployment.json"), "utf8")
  );
  assert.equal(deployment.databaseFingerprint, NEW_FINGERPRINT);
});

test("backup and build failures do not restore unrelated backups", async (t) => {
  for (const fail of ["build", "backup"]) {
    await t.test(fail, async (st) => {
      const { manager, events, hostDir } = fixture(st, { fail });
      const before = captureDeployment(hostDir);
      await manager.runUpdate("v1.0.0", "v1.1.0");
      assert.ok(
        ["failed", "rolled_back"].includes(manager.state.operation.phase)
      );
      assert.ok(!events.includes("restore"));
      if (fail === "build")
        assert.deepEqual(captureDeployment(hostDir), before);
    });
  }
});

test("update planning honors fingerprints, policy and rollback range", (t) => {
  const { hostDir } = fixture(t);
  const ordinary = planSourceUpdate(
    hostDir,
    {
      kind: "image",
      databaseFingerprint: OLD_FINGERPRINT,
      updatePolicy: policy(),
    },
    "v1.0.0"
  );
  assert.equal(ordinary.mode, "light");
  assert.equal(ordinary.rollbackCompatible, true);
  const changed = planSourceUpdate(
    hostDir,
    {
      kind: "image",
      databaseFingerprint: NEW_FINGERPRINT,
      updatePolicy: policy({ rollbackCompatible: false }),
    },
    "v1.0.0"
  );
  assert.equal(changed.mode, "full");
  assert.equal(changed.requiresBackup, true);
  assert.equal(changed.rollbackCompatible, false);
  assert.throws(
    () =>
      planSourceUpdate(
        hostDir,
        {
          kind: "image",
          databaseFingerprint: OLD_FINGERPRINT,
          updatePolicy: policy({ minimumVersion: "v1.1.0" }),
        },
        "v1.0.0"
      ),
    /请先更新/
  );
});

test("cleanup removes only obsolete images owned by this installation", async (t) => {
  const { manager, hostDir } = fixture(t);
  const activeApi = `sha256:${"1".repeat(64)}`;
  const activeApp = `sha256:${"2".repeat(64)}`;
  const rollbackApi = `sha256:${"3".repeat(64)}`;
  const obsolete = `sha256:${"4".repeat(64)}`;
  fs.writeFileSync(
    path.join(hostDir, "source-deployment.json"),
    JSON.stringify({
      kind: "image",
      runtimeImage: activeApi,
      appImage: activeApp,
    })
  );
  manager.state.rollbackDeployment = {
    "docker-compose.generated.yml": JSON.stringify({
      services: { api: { image: rollbackApi }, app: { image: activeApp } },
    }),
  };
  const removed = [];
  manager.runCommand = async (_cwd, _cmd, args) => {
    if (args[1] === "ls") {
      return {
        stdout: `${activeApi}\n${activeApp}\n${rollbackApi}\n${obsolete}\n`,
      };
    }
    removed.push(args.at(-1));
    return { stdout: "" };
  };
  await cleanupReleases(manager);
  assert.deepEqual(removed, [obsolete]);
});

test("operation lock excludes another updater process", (t) => {
  const { manager } = fixture(t);
  const unlock = acquireUpdateLock(manager.stateDir);
  assert.throws(() => acquireUpdateLock(manager.stateDir), /已有更新/);
  unlock();
});

test("runtime and source validation remain deterministic", () => {
  assert.equal(runtimeImage("FROM node\r\n"), runtimeImage("FROM node\n"));
  assert.notEqual(
    runtimeImage("FROM node:22\n"),
    runtimeImage("FROM node:24\n")
  );
  for (const ref of [
    "main",
    "../escape",
    "v1.0.0-beta",
    "--upload-pack=evil",
  ]) {
    assert.throws(() => validateSourceRef(ref));
  }
  assert.equal(
    sourceRemote("github", "tukeceshi/z3cz"),
    "https://github.com/tukeceshi/z3cz.git"
  );
  assert.equal(sourceRemote("gitee", "tukeceshi/z3cz"), GITEE_SOURCE_REMOTE);
});
