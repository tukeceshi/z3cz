import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareSourceRelease } from "./source-release.mjs";

function createCheckout(sourceDir, version) {
  fs.mkdirSync(path.join(sourceDir, "docker"), { recursive: true });
  fs.mkdirSync(path.join(sourceDir, "apps/api/src/db/migrations"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(sourceDir, "apps/api/src/db/schema"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(sourceDir, "VERSION"), version);
  fs.writeFileSync(path.join(sourceDir, "docker/source-protocol"), "2\n");
  fs.writeFileSync(
    path.join(sourceDir, "docker/Dockerfile.source"),
    "FROM node:22\n"
  );
  fs.writeFileSync(
    path.join(sourceDir, "docker/Dockerfile.update"),
    "FROM scratch\n"
  );
  fs.writeFileSync(
    path.join(sourceDir, "apps/api/drizzle.config.ts"),
    "config"
  );
  fs.writeFileSync(
    path.join(sourceDir, "apps/api/src/db/migrations/0000.sql"),
    "sql"
  );
  fs.writeFileSync(
    path.join(sourceDir, "apps/api/src/db/schema/index.ts"),
    "schema"
  );
  fs.writeFileSync(
    path.join(sourceDir, "update-policy.json"),
    JSON.stringify({
      format: 2,
      minimumVersion: "v0.0.0",
      minimumRollbackVersion: "v0.0.0",
      requiresBackup: false,
      databaseChanges: false,
      rollbackCompatible: true,
    })
  );
}

test("source preparation reuses one owned checkout and builds immutable images", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-release-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const hostDir = path.join(root, "host");
  fs.mkdirSync(hostDir, { recursive: true });
  const commit = "b".repeat(40);
  const image = `sha256:${"c".repeat(64)}`;
  const commands = [];
  let dirty = false;
  const run = async (_cwd, command, args) => {
    commands.push([command, ...args]);
    if (command === "git" && args.includes("worktree")) {
      createCheckout(args.at(-2), "v1.1.0");
    }
    if (command === "git" && args.includes("FETCH_HEAD^{commit}")) {
      return { stdout: commit, stderr: "" };
    }
    if (command === "git" && args.includes("--show-toplevel")) {
      return { stdout: path.join(hostDir, "shared/build/source"), stderr: "" };
    }
    if (command === "git" && args.includes("--porcelain")) {
      return { stdout: dirty ? " M VERSION" : "", stderr: "" };
    }
    if (command === "docker" && args[0] === "image" && args[1] === "inspect") {
      return {
        stdout: args.includes("--format") ? image : "present",
        stderr: "",
      };
    }
    return { stdout: "", stderr: "" };
  };
  const first = await prepareSourceRelease({
    hostDir,
    repository: "tukeceshi/z3cz",
    ref: "v1.1.0",
    version: "v1.1.0",
    run,
    log: () => {},
  });
  assert.equal(first.kind, "image");
  assert.equal(first.runtimeImage, image);
  const builds = commands.filter(
    ([command, ...args]) => command === "docker" && args[0] === "build"
  );
  assert.equal(builds.length, 2);
  assert.ok(builds.every((parts) => parts.includes("--target")));
  commands.length = 0;
  await prepareSourceRelease({
    hostDir,
    repository: "tukeceshi/z3cz",
    ref: "v1.1.0",
    version: "v1.1.0",
    run,
    log: () => {},
  });
  assert.ok(
    commands.some(
      ([command, ...args]) => command === "git" && args.includes("checkout")
    )
  );
  assert.ok(
    !commands.some(
      ([command, ...args]) => command === "git" && args.includes("worktree")
    )
  );
  dirty = true;
  await assert.rejects(
    prepareSourceRelease({
      hostDir,
      repository: "tukeceshi/z3cz",
      ref: "v1.1.0",
      version: "v1.1.0",
      run,
      log: () => {},
    }),
    /本地修改/
  );
});
