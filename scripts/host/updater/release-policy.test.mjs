import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const entry = path.join(import.meta.dirname, "main.mjs");

test("formal update policy blocks old versions and limits automatic rollback", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "z3cz-policy-"));
  try {
    fs.writeFileSync(
      path.join(directory, "update-policy.json"),
      JSON.stringify({
        format: 2,
        minimumVersion: "v1.0.5",
        minimumRollbackVersion: "v1.0.8",
        requiresBackup: true,
        databaseChanges: true,
        rollbackCompatible: true,
      })
    );
    const validate = (version) =>
      execFileSync(process.execPath, [entry, "validate-policy", directory, version], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    assert.equal(validate("v1.0.8"), "true");
    assert.equal(validate("v1.0.5"), "false");
    assert.throws(() => validate("v1.0.4"), /低于最低可升级版本/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
