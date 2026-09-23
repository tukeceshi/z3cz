import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("one-command installer has no Docker runtime dependency", () => {
  const files = [
    "scripts/host/bootstrap.sh",
    "scripts/host/configure.sh",
    "scripts/host/deploy.sh",
    "scripts/host/db-migrate.sh",
    "scripts/host/render-caddy.sh",
    "scripts/host/update.sh",
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /\bdocker(?:-compose| compose)?\b/i, file);
  }
});

test("native pack contains both architectures and checksums", () => {
  const script = read("scripts/host/pack-deploy.sh");
  assert.match(script, /build_arch amd64 x64/);
  assert.match(script, /build_arch arm64 arm64/);
  assert.match(script, /SHA256SUMS/);
  assert.match(script, /pnpm install --prod --frozen-lockfile/);
});

test("native deploy uses isolated release and state directories", () => {
  const bootstrap = read("scripts/host/bootstrap.sh");
  assert.match(bootstrap, /\/opt\/z3cz/);
  assert.match(bootstrap, /\/var\/lib\/z3cz/);
  assert.match(bootstrap, /\/etc\/z3cz/);
  assert.match(bootstrap, /current\.next/);
  assert.match(bootstrap, /ubuntu:26\.04/);
  assert.match(bootstrap, /chmod -R a\+rX/);
});
