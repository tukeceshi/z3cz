import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const common = path.join(root, "scripts/host/common.sh");
const compose = path.join(root, "docker-compose.prod.yml");

function prepare(contents) {
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "z3cz-env-"));
  const envFile = path.join(configDir, "z3cz.env");
  fs.writeFileSync(envFile, contents);
  const result = spawnSync(
    "bash",
    [
      "-c",
      'source "$1"; prepare_docker_env "$2"; printf "%s" "$(cat "$ENV_FILE")"',
      "bash",
      common,
      compose,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, Z3CZ_CONFIG_DIR: configDir, Z3CZ_PUBLIC_URL: "" },
    }
  );
  fs.rmSync(configDir, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("prepare_docker_env puts the boot cache on the uploads volume", () => {
  const env = prepare("RUNTIME=docker\nLOCAL_STORAGE_PATH=/var/lib/z3cz/uploads\n");
  assert.match(env, /^API_BOOT_CACHE_DIR=\/var\/lib\/z3cz\/uploads\/cache$/m);
});

test("prepare_docker_env moves a read-only /app boot cache onto the uploads volume", () => {
  const env = prepare(
    "RUNTIME=docker\nLOCAL_STORAGE_PATH=/var/lib/z3cz/uploads\nAPI_BOOT_CACHE_DIR=/app/data/storage/cache\n"
  );
  assert.match(env, /^API_BOOT_CACHE_DIR=\/var\/lib\/z3cz\/uploads\/cache$/m);
  assert.doesNotMatch(env, /API_BOOT_CACHE_DIR=\/app/);
});

test("prepare_docker_env keeps a custom boot cache directory", () => {
  const env = prepare(
    "RUNTIME=docker\nLOCAL_STORAGE_PATH=/var/lib/z3cz/uploads\nAPI_BOOT_CACHE_DIR=/var/lib/z3cz/boot\n"
  );
  assert.match(env, /^API_BOOT_CACHE_DIR=\/var\/lib\/z3cz\/boot$/m);
});
