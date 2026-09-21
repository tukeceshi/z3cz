import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";

import { runCommand } from "./docker.mjs";

/**
 * @param {string} filePath
 */
export async function sha256File(filePath) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return `sha256:${hash.digest("hex")}`;
}

/**
 * @param {string} backupDir
 */
export function checkBackupDiskSpace(backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  const stats = fs.statfsSync(backupDir);
  const available = Number(stats.bavail) * Number(stats.bsize);
  const minimum = 512 * 1024 * 1024;
  if (available < minimum) {
    throw new Error("备份目录可用空间不足 512MB，已中止");
  }
}

/**
 * @param {{
 *   backupDir: string,
 *   hostDir: string,
 *   compose: (args: string[], options?: object) => Promise<{ stdout: string, stderr: string }>,
 *   storageDir: string,
 *   version: string,
 * }} input
 */
export async function createBackup(input) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const id = `backup-${stamp.slice(0, 15)}`;
  const staging = path.join(input.backupDir, id);
  const archivePath = `${staging}.tar.gz`;
  fs.mkdirSync(staging, { recursive: true });
  try {
    await dumpBinaryPostgres(input, path.join(staging, "database.dump"));
    await runCommand(
      input.storageDir,
      "tar",
      ["-cf", path.join(staging, "storage.tar"), "."],
      { timeoutMs: 20 * 60 * 1000 }
    );
    fs.writeFileSync(
      path.join(staging, "metadata.json"),
      JSON.stringify(
        {
          id,
          version: input.version,
          createdAt: now.toISOString(),
          format: 1,
        },
        null,
        2
      )
    );
    await runCommand(input.backupDir, "tar", ["-czf", archivePath, id], {
      timeoutMs: 20 * 60 * 1000,
    });
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  const checksum = await sha256File(archivePath);
  const stat = fs.statSync(archivePath);
  await verifyBackupArchive(archivePath, checksum);
  return {
    id,
    path: archivePath,
    checksum,
    size: stat.size,
    createdAt: now.toISOString(),
    version: input.version,
  };
}

/**
 * @param {{ hostDir: string, composePath?: string, envPath?: string }} input
 * @param {string} dumpPath
 */
async function dumpBinaryPostgres(input, dumpPath) {
  const { spawn } = await import("node:child_process");
  const composeFile = path.join(input.hostDir, "docker-compose.generated.yml");
  const envFile = path.join(input.hostDir, ".env.generated");
  await new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "compose",
        "--env-file",
        envFile,
        "-f",
        composeFile,
        "exec",
        "-T",
        "postgres",
        "pg_dump",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-Fc",
      ],
      { cwd: input.hostDir, stdio: ["ignore", "pipe", "pipe"] }
    );
    const out = createWriteStream(dumpPath);
    const written = pipeline(child.stdout, out);
    written.catch(reject);
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    out.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        written.then(resolve, reject);
        return;
      }
      reject(new Error(stderr.trim() || `pg_dump 退出码 ${code}`));
    });
  });
}

/**
 * @param {string} archivePath
 * @param {string} expected
 */
export async function verifyBackupArchive(archivePath, expected) {
  const actual = await sha256File(archivePath);
  if (actual !== expected) {
    throw new Error("备份校验失败");
  }
  const listing = await runCommand(path.dirname(archivePath), "tar", [
    "-tzf",
    archivePath,
  ]);
  const names = listing.stdout.split(/\r?\n/);
  for (const required of ["metadata.json", "database.dump", "storage.tar"]) {
    if (!names.some((name) => name.endsWith(required))) {
      throw new Error(`备份缺少 ${required}`);
    }
  }
}

/**
 * @param {{
 *   backup: { path: string, checksum: string },
 *   hostDir: string,
 *   storageDir: string,
 * }} input
 */
export async function restoreBackup(input) {
  await verifyBackupArchive(input.backup.path, input.backup.checksum);
  const staging = `${input.backup.path}.restore`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  try {
    await runCommand(path.dirname(input.backup.path), "tar", [
      "-xzf",
      input.backup.path,
      "-C",
      staging,
      "--strip-components",
      "1",
    ]);
    const dumpPath = path.join(staging, "database.dump");
    const storageTar = path.join(staging, "storage.tar");
    if (!fs.existsSync(dumpPath) || !fs.existsSync(storageTar)) {
      const nested = fs.readdirSync(staging).find((name) => name.startsWith("backup-"));
      const dumpNested = nested
        ? path.join(staging, nested, "database.dump")
        : dumpPath;
      const storageNested = nested
        ? path.join(staging, nested, "storage.tar")
        : storageTar;
      await restorePostgresDump(input.hostDir, dumpNested);
      await restoreStorage(input.storageDir, storageNested);
    } else {
      await restorePostgresDump(input.hostDir, dumpPath);
      await restoreStorage(input.storageDir, storageTar);
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

async function restorePostgresDump(hostDir, dumpPath) {
  const { spawn } = await import("node:child_process");
  const composeFile = path.join(hostDir, "docker-compose.generated.yml");
  const envFile = path.join(hostDir, ".env.generated");
  await new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "compose",
        "--env-file",
        envFile,
        "-f",
        composeFile,
        "exec",
        "-T",
        "postgres",
        "pg_restore",
        "-U",
        "postgres",
        "-d",
        "template1",
        "--create",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
      ],
      { cwd: hostDir, stdio: ["pipe", "ignore", "pipe"] }
    );
    createReadStream(dumpPath).pipe(child.stdin);
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `pg_restore 退出码 ${code}`));
    });
  });
}

async function restoreStorage(storageDir, tarPath) {
  for (const entry of fs.readdirSync(storageDir)) {
    fs.rmSync(path.join(storageDir, entry), { recursive: true, force: true });
  }
  await runCommand(storageDir, "tar", ["-xf", tarPath]);
}
