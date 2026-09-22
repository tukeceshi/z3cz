import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { reusableBackup, sha256File } from "./backup.mjs";

test("reusableBackup checks age, database identity and archive contents", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "backup-reuse-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const staging = path.join(root, "backup-test");
  fs.mkdirSync(staging);
  for (const name of ["metadata.json", "database.dump", "storage.tar"]) {
    fs.writeFileSync(path.join(staging, name), name);
  }
  const archive = path.join(root, "backup-test.tar.gz");
  const { spawnSync } = await import("node:child_process");
  const packed = spawnSync("tar", ["-czf", archive, "backup-test"], {
    cwd: root,
  });
  assert.equal(packed.status, 0, packed.stderr?.toString());
  const backup = {
    path: archive,
    checksum: await sha256File(archive),
    createdAt: new Date().toISOString(),
    databaseFingerprint: "schema-a",
  };
  assert.equal(await reusableBackup(backup, "schema-a", 60_000), true);
  assert.equal(await reusableBackup(backup, "schema-b", 60_000), false);
  assert.equal(
    await reusableBackup(
      { ...backup, createdAt: new Date(Date.now() - 120_000).toISOString() },
      "schema-a",
      60_000
    ),
    false
  );
  fs.appendFileSync(archive, "corrupt");
  assert.equal(await reusableBackup(backup, "schema-a", 60_000), false);
});
