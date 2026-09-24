import assert from "node:assert/strict";
import test from "node:test";

import { isUpdateLogNoise } from "./update-log.mjs";

test("dependency install chatter is dropped and real steps are kept", () => {
  assert.equal(isUpdateLogNoise("+ ws 8.21.3"), true);
  assert.equal(isUpdateLogNoise("+ zod 4.6.5"), true);
  assert.equal(isUpdateLogNoise("++++++"), true);
  assert.equal(isUpdateLogNoise("Packages: +142"), true);
  assert.equal(
    isUpdateLogNoise(
      "Progress: resolved 1, reused 1, downloaded 0, added 1"
    ),
    true
  );
  assert.equal(isUpdateLogNoise("Already up to date"), true);
  assert.equal(isUpdateLogNoise("npm notice created a lockfile"), true);
  assert.equal(isUpdateLogNoise("npm warn deprecated"), true);
  assert.equal(isUpdateLogNoise("WARN 1 deprecated subdependencies found"), true);
  assert.equal(isUpdateLogNoise("   "), true);

  assert.equal(isUpdateLogNoise("==> 复核后台已下载的 v1.2.3"), false);
  assert.equal(isUpdateLogNoise("==> 正在安装生产依赖"), false);
  assert.equal(isUpdateLogNoise("ERROR: 迁移失败"), false);
  assert.equal(
    isUpdateLogNoise("新应用健康检查失败，已自动回退到旧版本"),
    false
  );
  assert.equal(isUpdateLogNoise("维护模式已保留"), false);
});
