import fs from "node:fs";
import path from "node:path";

export function releaseRollbackPath(stateDir) {
  return path.join(stateDir, "release-rollback.json");
}

export function readReleaseRollback(stateDir) {
  try {
    const record = JSON.parse(
      fs.readFileSync(releaseRollbackPath(stateDir), "utf8")
    );
    if (
      !record ||
      typeof record.fromVersion !== "string" ||
      typeof record.previous !== "string" ||
      typeof record.backupPath !== "string" ||
      typeof record.rollbackCompatible !== "boolean"
    ) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

export function clearReleaseRollback(stateDir) {
  fs.rmSync(releaseRollbackPath(stateDir), { force: true });
}

export function isReleaseInstall(installDir) {
  return fs.existsSync(path.join(installDir, "current", "VERSION"));
}

export function readInstalledPrevious(installDir) {
  const previousLink = path.join(installDir, "previous");
  const currentLink = path.join(installDir, "current");
  if (!fs.existsSync(previousLink) || !fs.existsSync(currentLink)) return null;
  let previous;
  let current;
  try {
    previous = fs.realpathSync(previousLink);
    current = fs.realpathSync(currentLink);
  } catch {
    return null;
  }
  if (previous === current) return null;
  const versionFile = path.join(previous, "VERSION");
  if (!fs.existsSync(versionFile)) return null;
  const version = fs.readFileSync(versionFile, "utf8").trim();
  if (!version) return null;
  return { version, previous };
}

function backupMetadata(filePath, version, checksum, createdAt, size) {
  if (!filePath || !fs.existsSync(filePath)) return undefined;
  const stat = fs.statSync(filePath);
  const normalized = String(checksum || "");
  return {
    id: path.basename(filePath, ".dump"),
    path: filePath,
    checksum: normalized
      ? normalized.startsWith("sha256:")
        ? normalized
        : `sha256:${normalized}`
      : "",
    size: Number(size) || stat.size,
    createdAt: createdAt || stat.mtime.toISOString(),
    version,
  };
}

function findDump(backupDir, version) {
  if (!backupDir || !fs.existsSync(backupDir)) return undefined;
  const prefix = `z3cz-before-${version.replace(/^v/, "")}-`;
  const candidates = fs
    .readdirSync(backupDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".dump"))
    .map((name) => {
      const full = path.join(backupDir, name);
      const stat = fs.statSync(full);
      return { full, mtimeMs: stat.mtimeMs, size: stat.size, mtime: stat.mtime };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
  const newest = candidates[0];
  if (!newest) return undefined;
  let checksum = "";
  const sumFile = `${newest.full}.sha256`;
  if (fs.existsSync(sumFile)) {
    const hex = fs.readFileSync(sumFile, "utf8").trim().split(/\s+/)[0] || "";
    if (/^[a-f0-9]{64}$/.test(hex)) checksum = hex;
  }
  return backupMetadata(
    newest.full,
    version,
    checksum,
    newest.mtime.toISOString(),
    newest.size
  );
}

/**
 * Release installs keep the previous tree on disk. The rollback record is
 * written only after a successful update; an older host can still roll code
 * back from the previous link alone.
 */
export function describeReleaseRollback(installDir, stateDir, backupDir) {
  if (!isReleaseInstall(installDir)) return null;
  const installed = readInstalledPrevious(installDir);
  if (!installed) return null;
  const record = readReleaseRollback(stateDir);
  const matches = Boolean(
    record &&
      record.fromVersion === installed.version &&
      path.resolve(record.previous) === installed.previous
  );
  const backup = matches
    ? backupMetadata(
        record.backupPath,
        record.fromVersion,
        record.backupChecksum,
        record.createdAt,
        record.backupBytes
      )
    : findDump(backupDir, installed.version);
  return {
    version: installed.version,
    requiresRestore: Boolean(matches && record.rollbackCompatible === false),
    backup,
  };
}
