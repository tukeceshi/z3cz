import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { applyHostPack, isHostPackExcluded } from "./host-pack.mjs";
import { runCommand } from "./docker.mjs";

test("applyHostPack overlays scripts and keeps app.yml", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "z3cz-pack-"));
  const packRoot = path.join(root, "pack");
  const installDir = path.join(root, "install");
  fs.mkdirSync(path.join(packRoot, "scripts", "host"), { recursive: true });
  fs.mkdirSync(path.join(packRoot, "docker-host", "containers"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(packRoot, "scripts", "host", "hello.sh"), "echo hi\n");
  fs.writeFileSync(
    path.join(packRoot, "docker-host", "containers", "app.yml"),
    "from-pack\n"
  );
  fs.mkdirSync(path.join(installDir, "docker-host", "containers"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(installDir, "docker-host", "containers", "app.yml"),
    "keep-me\n"
  );
  const archivePath = path.join(root, "pack.tar.gz");
  await runCommand(packRoot, "tar", ["-czf", archivePath, "."]);
  await applyHostPack({
    archivePath,
    installDir,
    runCommand,
  });
  assert.equal(
    fs.readFileSync(
      path.join(installDir, "docker-host", "containers", "app.yml"),
      "utf8"
    ),
    "keep-me\n"
  );
  assert.equal(
    fs.readFileSync(path.join(installDir, "scripts", "host", "hello.sh"), "utf8"),
    "echo hi\n"
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("isHostPackExcluded covers tenant data paths", () => {
  assert.equal(isHostPackExcluded("docker-host/containers/app.yml"), true);
  assert.equal(isHostPackExcluded("./docker-host/shared/storage/a"), true);
  assert.equal(isHostPackExcluded("scripts/host/deploy.sh"), false);
});
