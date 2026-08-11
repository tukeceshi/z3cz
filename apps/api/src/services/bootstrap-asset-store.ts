import fs from "node:fs";
import path from "node:path";

import type { BootstrapManifest } from "@dafthunk/types";

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

export function invalidateBootstrapAssetCache(): void {
  cachedManifest = null;
  cachedRoot = null;
}
