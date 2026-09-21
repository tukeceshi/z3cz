import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createBackup, restoreBackup, sha256File } from "./backup.mjs";
import { createComposeRunner, runCommand } from "./docker.mjs";

test("Postgres backup restores data, removes newer schema, and rejects a corrupt dump", {
  skip: process.env.Z3CZ_DOCKER_TEST !== "1", timeout: 180_000,
}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "z3cz-backup-test-"));
  const storageDir = path.join(root, "storage");
  const backupDir = path.join(root, "backups");
  fs.mkdirSync(storageDir);
  fs.mkdirSync(backupDir);
  fs.writeFileSync(path.join(storageDir, "sample.txt"), "before");
  const composePath = path.join(root, "docker-compose.generated.yml");
  const envPath = path.join(root, ".env.generated");
  fs.writeFileSync(envPath, "");
  fs.writeFileSync(composePath, JSON.stringify({ name: `z3cz-backup-test-${randomUUID().slice(0, 8)}`,
    services: { postgres: { image: "postgres:16-alpine", pull_policy: "never",
      environment: { POSTGRES_PASSWORD: "test-only" },
      healthcheck: { test: ["CMD-SHELL", "pg_isready -U postgres"], interval: "1s", timeout: "3s", retries: 30 },
    } },
  }));
  const compose = createComposeRunner(root, composePath, envPath);
  const sql = (query) => compose(["exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", query]);
  try {
    await compose(["up", "-d", "--wait"]);
    await sql("CREATE TABLE sample (value text); INSERT INTO sample VALUES ('before');");
    const backup = await createBackup({ hostDir: root, storageDir, backupDir, compose, version: "v1.0.0" });
    await sql("UPDATE sample SET value='after'; CREATE TABLE added_by_new_version (id int);");
    fs.writeFileSync(path.join(storageDir, "sample.txt"), "after");
    await restoreBackup({ backup, hostDir: root, storageDir });
    assert.equal((await sql("SELECT value FROM sample")).stdout.trim(), "before");
    assert.equal((await sql("SELECT to_regclass('public.added_by_new_version') IS NULL")).stdout.trim(), "t");
    assert.equal(fs.readFileSync(path.join(storageDir, "sample.txt"), "utf8"), "before");
    const invalid = path.join(root, "invalid");
    fs.mkdirSync(invalid);
    fs.writeFileSync(path.join(invalid, "database.dump"), "invalid dump");
    fs.writeFileSync(path.join(invalid, "metadata.json"), "{}");
    await runCommand(storageDir, "tar", ["-cf", path.join(invalid, "storage.tar"), "."]);
    const archive = path.join(root, "invalid.tar.gz");
    await runCommand(root, "tar", ["-czf", archive, "invalid"]);
    await assert.rejects(() => restoreBackup({ hostDir: root, storageDir,
      backup: { path: archive, checksum: "" } }), /校验失败/);
    const checksum = await sha256File(archive);
    await assert.rejects(() => restoreBackup({ hostDir: root, storageDir, backup: { path: archive, checksum } }));
  } finally {
    await compose(["down", "--volumes", "--remove-orphans"]);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
