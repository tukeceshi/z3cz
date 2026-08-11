import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type {
  BootstrapManifest,
  BootstrapManifestFile,
} from "@dafthunk/types";

const PRELOAD_FILE_COUNT = 20;

const MANIFEST_FILE = "bootstrap-manifest.json";

let cachedManifest: BootstrapManifest | null = null;
let cachedRoot: string | null = null;

function resolveBootstrapRoot(): string | null {
  const candidates = [
    process.env.BOOTSTRAP_ASSETS_DIR,
    path.resolve(process.cwd(), "../app/dist"),
    path.resolve(process.cwd(), "apps/app/dist"),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const candidate of candidates) {
    const manifestPath = path.join(candidate, MANIFEST_FILE);
    if (fs.existsSync(manifestPath)) {
      return candidate;
    }
  }

  return null;
}

function readManifestFromDisk(root: string): BootstrapManifest {
  const raw = fs.readFileSync(path.join(root, MANIFEST_FILE), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid bootstrap manifest");
  }
  return parsed as BootstrapManifest;
}

export function getBootstrapAssetsRoot(): string | null {
  if (cachedRoot && fs.existsSync(path.join(cachedRoot, MANIFEST_FILE))) {
    return cachedRoot;
  }

  cachedRoot = resolveBootstrapRoot();
  cachedManifest = cachedRoot ? readManifestFromDisk(cachedRoot) : null;
  return cachedRoot;
}

export function getBootstrapManifest(): BootstrapManifest | null {
  if (!cachedManifest) {
    getBootstrapAssetsRoot();
  }
  return cachedManifest;
}

export function isBootstrapAssetPath(assetPath: string): boolean {
  const manifest = getBootstrapManifest();
  if (!manifest) {
    return false;
  }
  return manifest.files.some((file) => file.path === assetPath);
}

export function resolveBootstrapAssetFile(assetPath: string): string | null {
  if (!assetPath.startsWith("/assets/") || assetPath.includes("..")) {
    return null;
  }
  if (!isBootstrapAssetPath(assetPath)) {
    return null;
  }

  const root = getBootstrapAssetsRoot();
  if (!root) {
    return null;
  }

  const relative = assetPath.replace(/^\//, "");
  const absolute = path.join(root, relative);
  const normalizedRoot = path.resolve(root);
  const normalizedAbsolute = path.resolve(absolute);
  if (!normalizedAbsolute.startsWith(normalizedRoot)) {
    return null;
  }
  if (!fs.existsSync(normalizedAbsolute)) {
    return null;
  }
  return normalizedAbsolute;
}

export function readBootstrapAsset(assetPath: string): Buffer | null {
  const filePath = resolveBootstrapAssetFile(assetPath);
  if (!filePath) {
    return null;
  }
  return fs.readFileSync(filePath);
}

export function invalidateBootstrapAssetCache(): void {
  cachedManifest = null;
  cachedRoot = null;
}

export function getBootstrapPreloadFiles(
  manifest: BootstrapManifest
): BootstrapManifestFile[] {
  if (manifest.preloadFiles && manifest.preloadFiles.length > 0) {
    return manifest.preloadFiles.map((file) => ({
      path: file.path,
      size: file.size,
    }));
  }

  return [...manifest.files]
    .sort((left, right) => right.size - left.size)
    .slice(0, PRELOAD_FILE_COUNT)
    .map((file) => ({
      path: file.path,
      size: file.size,
    }));
}

export function computeManifestVersion(manifest: BootstrapManifest): string {
  const payload = manifest.files
    .map((file) => `${file.path}:${file.size}`)
    .sort()
    .join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
