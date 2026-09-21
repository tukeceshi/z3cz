import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { UpdateManager } from "./manager.mjs";
import { acquireUpdateLock, captureDeployment } from "./source-update.mjs";
import {
  runtimeImage,
  validateSourceRef,
  prepareSourceRelease,
} from "./source-release.mjs";

function fixture(t, fail = "") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-update-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const hostDir = path.join(root, "docker-host");
  fs.mkdirSync(path.join(hostDir, "containers"), { recursive: true });
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
  const events = [];
  const image = `sha256:${"a".repeat(64)}`;
  const manager = new UpdateManager({
    hostDir,
    installDir: root,
    appYmlPath: path.join(hostDir, "containers/app.yml"),
    composePath: path.join(hostDir, "docker-compose.generated.yml"),
    envPath: path.join(hostDir, ".env.generated"),
    stateDir: path.join(root, "state"),
    backupDir: path.join(root, "backups"),
    storageDir: path.join(hostDir, "shared/storage"),
    prepareSource: async () => {
      events.push("build");
      if (fail === "build") throw new Error("build failed");
      return {
        sourceDir: path.join(hostDir, "shared/releases/new"),
        runtimeImage: image,
        appImage: image,
      };
    },
    createBackup: async () => {
      events.push("backup");
      assert.ok(
        fs.existsSync(path.join(hostDir, "shared/maintenance/enabled"))
      );
      if (fail === "backup") throw new Error("backup failed");
      return { id: "this-update", version: "v1.0.0" };
    },
    restoreBackup: async ({ backup }) => {
      events.push("restore");
      assert.equal(backup.id, "this-update");
      if (fail === "restore") throw new Error("restore failed");
    },
    runCommand: async (_cwd, _cmd, args) => ({
      stdout: args[0] === "inspect" ? image : "",
      stderr: "",
    }),
    compose: async (args) => {
      events.push(args.join(" "));
      if (args[0] === "ps") return { stdout: "old-container", stderr: "" };
      if (args.includes("json"))
        return {
          stdout: JSON.stringify({
            services: { api: { image: "old" }, app: { image: "old" } },
          }),
          stderr: "",
        };
      if (
        args.includes("db:migrate") &&
        ["migration", "restore"].includes(fail)
      )
        throw new Error("migration failed");
      return { stdout: "", stderr: "" };
    },
  });
  manager.verifyHealth = async (version) => {
    events.push(`health ${version}`);
    assert.ok(fs.existsSync(path.join(hostDir, "shared/maintenance/enabled")));
  };
  return { manager, events, hostDir, root };
}

test("source update builds before stopping, backs up after stop and opens writes only after health", async (t) => {
  const { manager, events, hostDir } = fixture(t);
  await manager.runUpdate("v1.0.0", "v1.1.0");
  assert.equal(manager.state.operation.phase, "succeeded");
  assert.ok(events.indexOf("build") < events.indexOf("stop caddy api app"));
  assert.ok(events.indexOf("stop caddy api app") < events.indexOf("backup"));
  assert.ok(
    events.indexOf("backup") < events.findIndex((x) => x.includes("db:migrate"))
  );
  assert.ok(events.includes("health v1.1.0"));
  assert.ok(!fs.existsSync(path.join(hostDir, "shared/maintenance/enabled")));
  const compose = fs.readFileSync(manager.composePath, "utf8");
  assert.match(compose, /pull_policy: never/);
  assert.match(
    compose.replaceAll("\\", "/").replaceAll("//", "/"),
    /shared\/releases\/new:\/app:ro/
  );
  assert.match(compose, /BOOTSTRAP_ASSETS_DIR: \/app\/apps\/app\/dist/);
  assert.match(
    manager.state.rollbackDeployment["docker-compose.generated.yml"],
    /sha256:/
  );
});

test("build failure never modifies active deployment or stops services", async (t) => {
  const { manager, events, hostDir } = fixture(t, "build");
  const before = captureDeployment(hostDir);
  await manager.runUpdate("v1.0.0", "v1.1.0");
  assert.equal(manager.state.operation.phase, "failed");
  assert.deepEqual(captureDeployment(hostDir), before);
  assert.deepEqual(events, ["build"]);
});

test("failed backup restarts old version without restoring a stale backup", async (t) => {
  const { manager, events } = fixture(t, "backup");
  manager.state.lastBackup = { id: "stale" };
  await manager.runUpdate("v1.0.0", "v1.1.0");
  assert.equal(manager.state.operation.phase, "rolled_back");
  assert.ok(!events.includes("restore"));
  assert.equal(manager.currentVersion(), "v1.0.0");
});

test("migration failure restores this update backup and old configuration", async (t) => {
  const { manager, events, hostDir } = fixture(t, "migration");
  await manager.runUpdate("v1.0.0", "v1.1.0");
  assert.equal(manager.state.operation.phase, "rolled_back");
  assert.ok(events.indexOf("restore") < events.indexOf("health v1.0.0"));
  assert.equal(
    fs.readFileSync(path.join(hostDir, ".env.generated"), "utf8"),
    "old-env"
  );
  assert.ok(!fs.existsSync(path.join(hostDir, "source-deployment.json")));
});

test("restore failure keeps maintenance enabled and does not claim success", async (t) => {
  const { manager, hostDir, events } = fixture(t, "restore");
  await manager.runUpdate("v1.0.0", "v1.1.0");
  assert.equal(manager.state.operation.phase, "manual_intervention");
  assert.ok(fs.existsSync(path.join(hostDir, "shared/maintenance/enabled")));
  assert.ok(!events.includes("health v1.0.0"));
});

test("operation lock excludes another updater process", (t) => {
  const { manager } = fixture(t);
  const unlock = acquireUpdateLock(manager.stateDir);
  assert.throws(() => acquireUpdateLock(manager.stateDir), /已有更新/);
  unlock();
});

test("interrupted pre-migration update recovers configuration without restoring an older backup", async (t) => {
  const { manager, hostDir, events } = fixture(t);
  manager.state.pendingUpdate = { deployment: captureDeployment(hostDir), version: "v1.0.0", migrationStarted: false, fresh: false };
  await manager.runRollback("v1.0.0", { id: "stale" }, false);
  assert.equal(manager.state.operation.phase, "rolled_back");
  assert.ok(!events.includes("restore"));
  assert.equal(manager.state.pendingUpdate, null);
});

test("runtime identity changes only when environment definition changes", () => {
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
});

test("preparation uses git cache and package cache, no application-image downloads", async (t) => {
  const { hostDir } = fixture(t);
  const commands = [];
  const sha = "b".repeat(40);
  let sourceDir;
  const run = async (_cwd, command, args) => {
    commands.push([command, ...args].join(" "));
    if (args.includes("rev-parse")) return { stdout: sha };
    if (args.includes("worktree")) {
      sourceDir = args.at(-2);
      fs.mkdirSync(path.join(sourceDir, "docker"), { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "VERSION"), "v1.1.0");
      fs.writeFileSync(
        path.join(sourceDir, "docker/Dockerfile.source"),
        "FROM node\n"
      );
      fs.writeFileSync(path.join(sourceDir, "docker/source-protocol"), "1\n");
    }
    if (args[0] === "run") {
      fs.mkdirSync(path.join(sourceDir, "apps/app/dist"), { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "apps/app/dist/index.html"), "ok");
    }
    return { stdout: `sha256:${"a".repeat(64)}` };
  };
  const result = await prepareSourceRelease({
    hostDir,
    repository: "tukeceshi/z3cz",
    ref: "v1.1.0",
    version: "v1.1.0",
    run,
    log: () => {},
  });
  assert.equal(result.commit, sha);
  assert.ok(
    commands.some(
      (c) => c.includes("fetch --no-tags") && c.includes("refs/tags/v1.1.0")
    )
  );
  assert.ok(commands.some((c) => c.includes("--store-dir /pnpm-store")));
  assert.ok(!commands.some((c) => c.includes("docker pull")));
});
