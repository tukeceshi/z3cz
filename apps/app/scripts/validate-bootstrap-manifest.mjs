import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, "../dist");
const manifestPath = path.join(distDir, "bootstrap-manifest.json");

function parseArchive(raw) {
  const bytes = new Uint8Array(raw);
  const headerLength =
    (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const headerStart = 4;
  const headerEnd = headerStart + headerLength;
  const headerText = new TextDecoder().decode(
    bytes.subarray(headerStart, headerEnd)
  );
  const header = JSON.parse(headerText);
  const files = {};
  let offset = headerEnd;
  for (const file of header.files) {
    files[file.path] = bytes.subarray(offset, offset + file.size);
    offset += file.size;
  }
  return { header, files };
}

function hashGzip(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

function assetFilePath(assetPath) {
  const relative = assetPath.replace(/^\/assets\//, "");
  return path.join(distDir, "assets", relative);
}

function validatePack(pack) {
  const gzipPath = assetFilePath(pack.path);
  if (!fs.existsSync(gzipPath)) {
    throw new Error(`Missing pack file: ${pack.path}`);
  }

  const compressed = fs.readFileSync(gzipPath);
  const actualHash = hashGzip(compressed);
  if (pack.hash && actualHash !== pack.hash) {
    throw new Error(
      `Hash mismatch for pack "${pack.id}": expected ${pack.hash}, got ${actualHash}`
    );
  }

  const raw = gunzipSync(compressed);
  const { files } = parseArchive(raw);
  const archivedPaths = new Set(Object.keys(files));

  for (const asset of pack.assets) {
    if (!archivedPaths.has(asset)) {
      throw new Error(
        `Pack "${pack.id}" manifest lists ${asset} but archive does not contain it`
      );
    }
    const diskPath = assetFilePath(asset);
    if (!fs.existsSync(diskPath)) {
      throw new Error(`Pack asset missing on disk: ${asset}`);
    }
    const diskBytes = fs.readFileSync(diskPath);
    const archiveBytes = files[asset];
    if (diskBytes.byteLength !== archiveBytes.byteLength) {
      throw new Error(`Size mismatch for ${asset} in pack "${pack.id}"`);
    }
  }

  return {
    id: pack.id,
    assets: pack.assets.length,
    gzipKb: Math.round(compressed.byteLength / 1024),
  };
}

function validateShell(shellPath, shellHash) {
  const gzipPath = assetFilePath(shellPath);
  if (!fs.existsSync(gzipPath)) {
    throw new Error(`Missing shell file: ${shellPath}`);
  }
  const compressed = fs.readFileSync(gzipPath);
  const actualHash = hashGzip(compressed);
  if (shellHash && actualHash !== shellHash) {
    throw new Error(
      `Shell hash mismatch: expected ${shellHash}, got ${actualHash}`
    );
  }
  const raw = gunzipSync(compressed);
  const { header, files } = parseArchive(raw);
  if (!header.entry) {
    throw new Error("Shell archive missing entry in header");
  }
  if (!files[header.entry]) {
    throw new Error(`Shell archive missing entry file ${header.entry}`);
  }
  return {
    files: Object.keys(files).length,
    gzipKb: Math.round(compressed.byteLength / 1024),
  };
}

function distFilePath(assetPath) {
  return path.join(distDir, assetPath.replace(/^\/+/, ""));
}

function hashFile(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

function validateStaticAsset(asset) {
  const diskPath = distFilePath(asset.path);
  if (!fs.existsSync(diskPath)) {
    throw new Error(`Missing static asset: ${asset.path}`);
  }

  const bytes = fs.readFileSync(diskPath);
  const actualHash = hashFile(bytes);
  if (asset.hash && actualHash !== asset.hash) {
    throw new Error(
      `Hash mismatch for static asset "${asset.path}": expected ${asset.hash}, got ${actualHash}`
    );
  }

  return {
    path: asset.path,
    bytes: bytes.byteLength,
  };
}

if (!fs.existsSync(manifestPath)) {
  console.error("bootstrap-manifest.json not found — run pnpm build first");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const shell = validateShell(manifest.shell, manifest.shellHash);
const packs = (manifest.prefetchPacks ?? []).map(validatePack);
const staticAssets = (manifest.staticAssets ?? []).map(validateStaticAsset);

console.log(
  JSON.stringify(
    {
      ok: true,
      entry: manifest.entry,
      shell,
      packs,
      staticAssets,
      routeMappings: Object.keys(manifest.routeToPacks ?? {}).length,
    },
    null,
    2
  )
);
