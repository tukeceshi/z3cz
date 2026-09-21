import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseAppYml, stringifyAppYml } from "../../../docker-host/lib/parse-app-yml.mjs";
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
  fs.writeFileSync(path.join(hostDir, "docker-compose.generated.yml"), "name: test\n");
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

