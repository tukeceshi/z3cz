import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { compareVersions, isReleaseVersion } from "./version.mjs";

export function readUpdatePolicy(sourceDir) {
  const file = path.join(sourceDir, "update-policy.json");
  if (!fs.existsSync(file)) return null;
  const policy = JSON.parse(fs.readFileSync(file, "utf8"));
  if (
    ![1, 2].includes(policy.format) ||
    typeof policy.databaseChanges !== "boolean" ||
    typeof policy.rollbackCompatible !== "boolean" ||
    !isReleaseVersion(policy.minimumVersion)
  ) {
    throw new Error("更新说明中的兼容信息无效");
  }
  if (
    policy.format === 2 &&
    (typeof policy.requiresBackup !== "boolean" ||
      !isReleaseVersion(policy.minimumRollbackVersion))
  ) {
    throw new Error("更新说明缺少备份要求或回退兼容范围");
  }
  return policy;
}

export function databaseFingerprint(sourceDir) {
  const hash = createHash("sha256");
  function visit(relative) {
    const file = path.join(sourceDir, relative);
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error("数据库文件不能使用符号链接");
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(file).sort())
        visit(`${relative}/${name}`);
    } else {
      hash
        .update(relative)
        .update("\0")
        .update(fs.readFileSync(file))
        .update("\0");
    }
  }
  visit("apps/api/drizzle.config.ts");
  visit("apps/api/src/db/migrations");
  visit("apps/api/src/db/schema");
  return hash.digest("hex");
}

export function planSourceUpdate(hostDir, source, fromVersion) {
  const policy =
    source.kind === "image"
      ? source.updatePolicy
      : readUpdatePolicy(source.sourceDir);
  if (
    policy &&
    (!isReleaseVersion(fromVersion) ||
      compareVersions(fromVersion, policy.minimumVersion) < 0)
  ) {
    if (policy.minimumVersion !== "v0.0.0") {
      throw new Error(`请先更新到 ${policy.minimumVersion} 或更高版本`);
    }
  }
  let previousFingerprint;
  let fingerprint = source.databaseFingerprint;
  try {
    const previous = JSON.parse(
      fs.readFileSync(path.join(hostDir, "source-deployment.json"), "utf8")
    );
    previousFingerprint =
      previous.databaseFingerprint || databaseFingerprint(previous.sourceDir);
    fingerprint ||= databaseFingerprint(source.sourceDir);
  } catch {
    // Unknown history requires migration and a fresh backup.
  }
  const unchanged = Boolean(
    previousFingerprint && fingerprint === previousFingerprint
  );
  const migrate = !unchanged || Boolean(policy?.databaseChanges);
  const declaredCompatible = Boolean(
    previousFingerprint &&
      policy?.format === 2 &&
      policy.rollbackCompatible &&
      isReleaseVersion(fromVersion) &&
      compareVersions(fromVersion, policy.minimumRollbackVersion) >= 0
  );
  const rollbackCompatible = Boolean(
    policy?.rollbackCompatible !== false &&
      ((unchanged && !policy?.databaseChanges) || declaredCompatible)
  );
  return {
    mode: migrate ? "full" : "light",
    migrate,
    rollbackCompatible,
    requiresBackup:
      !policy ||
      policy.format !== 2 ||
      policy.requiresBackup ||
      !rollbackCompatible ||
      !previousFingerprint,
    previousFingerprint,
    databaseFingerprint: fingerprint,
  };
}
