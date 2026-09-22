import assert from "node:assert/strict";
import test from "node:test";

import {
  compareVersions,
  displayVersion,
  dockerImageTag,
  isReleaseVersion,
} from "./version.mjs";

test("official versions compare by semver", () => {
  assert.equal(compareVersions("v1.9.0", "1.10.0"), -1);
  assert.equal(compareVersions("1.10.0", "v1.10.0"), 0);
  assert.equal(compareVersions("v1.2.0", "v1.3.0"), -1);
  assert.equal(compareVersions("1.3.0", "v1.2.9"), 1);
  assert.equal(compareVersions("v1.5.0", "v1.5.0"), 0);
});

test("prerelease is older than the same core version", () => {
  assert.equal(compareVersions("v1.4.0-rc.1", "v1.4.0"), -1);
  assert.equal(compareVersions("v1.4.0", "v1.4.0-rc.1"), 1);
});

test("latest and sha tags are older than a real release", () => {
  assert.equal(compareVersions("latest", "v1.0.0"), -1);
  assert.equal(compareVersions("sha-abc1234", "v1.0.0"), -1);
  assert.equal(isReleaseVersion("latest"), false);
  assert.equal(isReleaseVersion("v1.0.0"), true);
});

test("display and docker tags", () => {
  assert.equal(displayVersion("1.2.3"), "v1.2.3");
  assert.equal(displayVersion("v1.2.3"), "v1.2.3");
  assert.equal(displayVersion("latest"), "latest");
  assert.equal(dockerImageTag("v1.2.3"), "1.2.3");
  assert.equal(dockerImageTag("1.2.3"), "1.2.3");
});
