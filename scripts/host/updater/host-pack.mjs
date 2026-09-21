import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const HOST_PACK_EXCLUDES = [
  "docker-host/containers",
  "docker-host/shared",
  "docker-host/docker-compose.generated.yml",
  "docker-host/.env.generated",
  "docker-host/Caddyfile.generated",
];

/**
 * Overlay a release deploy pack onto the install directory without touching
 * tenant config, certificates, or data volumes.
 *
 * @param {{
 *   archivePath: string,
 *   installDir: string,
 *   runCommand: (
 *     cwd: string,
 *     command: string,
 *     args: string[],
 *     options?: object
 *   ) => Promise<{ stdout: string, stderr: string }>
 * }} input
 */
export async function applyHostPack(input) {
  const archivePath = path.resolve(input.archivePath);
  const installDir = path.resolve(input.installDir);
  if (!fs.existsSync(archivePath)) {
    throw new Error("未找到部署包");
  }
  if (!fs.existsSync(installDir)) {
    throw new Error("安装目录不存在");
  }
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "z3cz-host-pack-"));
  try {
    await input.runCommand(staging, "tar", [
      "-xzf",
      archivePath,
      "-C",
      staging,
    ]);
    overlayDirectory(staging, installDir);
    chmodHostScripts(installDir);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

/**
 * @param {string} relativePath
 */
export function isHostPackExcluded(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\.\//, "");
  return HOST_PACK_EXCLUDES.some(
    (prefix) =>
      normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

/**
 * @param {string} sourceRoot
 * @param {string} destRoot
 */
function overlayDirectory(sourceRoot, destRoot) {
  const stack = [""];
  while (stack.length > 0) {
    const relative = stack.pop() ?? "";
    const sourceDir = relative ? path.join(sourceRoot, relative) : sourceRoot;
    for (const name of fs.readdirSync(sourceDir)) {
      const childRelative = relative ? `${relative}/${name}` : name;
      if (isHostPackExcluded(childRelative)) {
        continue;
      }
      const sourcePath = path.join(sourceRoot, childRelative);
      const destPath = path.join(destRoot, childRelative);
      const stat = fs.lstatSync(sourcePath);
      if (stat.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        stack.push(childRelative);
        continue;
      }
      if (!stat.isFile()) {
        continue;
      }
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

/**
 * @param {string} installDir
 */
export function chmodHostScripts(installDir) {
  const scriptsDir = path.join(installDir, "scripts", "host");
  if (fs.existsSync(scriptsDir)) {
    for (const name of fs.readdirSync(scriptsDir)) {
      if (name.endsWith(".sh")) {
        fs.chmodSync(path.join(scriptsDir, name), 0o755);
      }
    }
  }
  for (const relative of [
    "docker-host/launcher",
    "docker-host/dafthunk-setup",
    "dist/z3cz-host-updater-linux-amd64",
    "dist/z3cz-host-updater-linux-arm64",
  ]) {
    const filePath = path.join(installDir, relative);
    if (fs.existsSync(filePath)) {
      fs.chmodSync(filePath, 0o755);
    }
  }
}
