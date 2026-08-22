import type { BootstrapManifest } from "@dafthunk/types";

import { buildBootstrapR2ObjectKey } from "./bootstrap-r2-client";

export function collectBootstrapAssetPaths(
  manifest: BootstrapManifest
): readonly string[] {
  const paths = [manifest.shell];
  for (const pack of manifest.prefetchPacks ?? []) {
    paths.push(pack.path);
  }
  for (const asset of manifest.staticAssets ?? []) {
    paths.push(asset.path);
  }
  return paths;
}

export interface BootstrapSyncPlan {
  readonly upToDate: boolean;
  readonly toUpload: readonly string[];
  readonly toPruneKeys: readonly string[];
  readonly skippedCount: number;
}

export function planBootstrapSync(
  local: BootstrapManifest,
  remote: BootstrapManifest | null
): BootstrapSyncPlan {
  if (remote?.manifestVersion === local.manifestVersion) {
    return {
      upToDate: true,
      toUpload: [],
      toPruneKeys: [],
      skippedCount: collectBootstrapAssetPaths(local).length,
    };
  }

  const localKeys = new Map<string, string>();
  for (const assetPath of collectBootstrapAssetPaths(local)) {
    localKeys.set(buildBootstrapR2ObjectKey(assetPath), assetPath);
  }

  const remoteKeySet = new Set<string>();
  if (remote) {
    for (const assetPath of collectBootstrapAssetPaths(remote)) {
      remoteKeySet.add(buildBootstrapR2ObjectKey(assetPath));
    }
  }

  const toUpload: string[] = [];
  let skippedCount = 0;
  for (const [key, assetPath] of localKeys) {
    if (remoteKeySet.has(key)) {
      skippedCount += 1;
    } else {
      toUpload.push(assetPath);
    }
  }

  const toPruneKeys = [...remoteKeySet].filter((key) => !localKeys.has(key));

  return {
    upToDate: false,
    toUpload,
    toPruneKeys,
    skippedCount,
  };
}

export function parseRemoteBootstrapManifest(
  body: Uint8Array
): BootstrapManifest {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("manifestVersion" in parsed) ||
    typeof (parsed as BootstrapManifest).manifestVersion !== "string"
  ) {
    throw new Error("Invalid remote bootstrap manifest");
  }
  return parsed as BootstrapManifest;
}
