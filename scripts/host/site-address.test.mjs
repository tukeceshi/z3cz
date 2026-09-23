import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const common = path.resolve(import.meta.dirname, "common.sh");

function normalize(input) {
  return spawnSync(
    "bash",
    ["-c", 'source "$1"; normalize_site_address "$2"', "bash", common, input],
    { encoding: "utf8" }
  );
}

test("normalize_site_address accepts a public hostname and HTTP init", () => {
  const cases = [
    ["", ":80"],
    ["   ", ":80"],
    [":80", ":80"],
    ["Example.COM", "example.com"],
    ["https://Example.COM/", "example.com"],
    ["http://example.com", "example.com"],
    ["example.com.", "example.com"],
    ["my-site.example.co.uk", "my-site.example.co.uk"],
  ];
  for (const [input, expected] of cases) {
    const result = normalize(input);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
  }
});

test("normalize_site_address rejects local names, IPs, ports, and paths", () => {
  for (const input of [
    "localhost",
    "127.0.0.1",
    "1.2.3.4",
    "::1",
    "example.com:443",
    "https://example.com/path",
    "example",
    "*.example.com",
    "not a domain",
  ]) {
    const result = normalize(input);
    assert.notEqual(result.status, 0, input);
    assert.equal(result.stdout, "");
  }
});

test("resolve_site_address uses Z3CZ_SITE_ADDRESS and does not read the terminal", () => {
  const result = spawnSync(
    "bash",
    ["-c", 'source "$1"; resolve_site_address', "bash", common],
    {
      encoding: "utf8",
      env: { ...process.env, Z3CZ_SITE_ADDRESS: "https://Example.COM/" },
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "example.com");
});

test("resolve_site_address rejects an invalid preset domain", () => {
  const result = spawnSync(
    "bash",
    ["-c", 'source "$1"; resolve_site_address', "bash", common],
    {
      encoding: "utf8",
      env: { ...process.env, Z3CZ_SITE_ADDRESS: "localhost" },
    }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Z3CZ_SITE_ADDRESS/);
});

test("first install prompts for a domain and derives the public origin", () => {
  const install = fs.readFileSync(
    path.join(import.meta.dirname, "install.sh"),
    "utf8"
  );
  assert.match(install, /resolve_site_address/);
  assert.match(install, /https:\/\/\$\{SITE_ADDRESS\}/);
  const update = fs.readFileSync(
    path.join(import.meta.dirname, "update.sh"),
    "utf8"
  );
  assert.doesNotMatch(update, /resolve_site_address/);
});
