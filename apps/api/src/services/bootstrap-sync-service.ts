import fs from "node:fs";
import type { BootstrapSettings, BootstrapSyncResult } from "@dafthunk/types";

import type { Bindings } from "../context";
import {
  getBootstrapAssetsRoot,
  getBootstrapManifest,
  invalidateBootstrapAssetCache,
  resolveBootstrapAssetDiskPath,
} from "./bootstrap-asset-store";
import {
  buildBootstrapR2ObjectKey,
  buildBootstrapR2PublicUrl,
  contentTypeForBootstrapAsset,
  uploadBootstrapShellToR2,
} from "./bootstrap-r2-client";
import {
  getBootstrapStorageProvider,
  isBootstrapStorageConfigured,
  resolveBootstrapR2SecretAccessKey,
} from "./bootstrap-settings";
import { createBootstrapTosClient } from "./bootstrap-storage-sources";

async function uploadBootstrapAssetToR2(
  settings: BootstrapSettings,
  env: Bindings,
  assetPath: string
): Promise<{ r2Key: string; r2Url: string; bytes: number }> {
  const root = getBootstrapAssetsRoot();
  if (!root) {
    throw new Error("Bootstrap assets root unavailable");
  }

  const absolutePath = resolveBootstrapAssetDiskPath(root, assetPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Bootstrap asset missing on server: ${assetPath}`);
  }

  const body = new Uint8Array(fs.readFileSync(absolutePath));
  const secretAccessKey = await resolveBootstrapR2SecretAccessKey(
    settings,
    env
  );
  const key = buildBootstrapR2ObjectKey(assetPath);

  await uploadBootstrapShellToR2({
    credentials: {
      accountId: settings.accountId,
      accessKeyId: settings.accessKeyId,
      secretAccessKey,
      bucketName: settings.bucketName,
    },
    key,
    body,
    contentType: contentTypeForBootstrapAsset(assetPath),
  });

  return {
    r2Key: key,
    r2Url: buildBootstrapR2PublicUrl(settings.publicBaseUrl, assetPath),
    bytes: body.byteLength,
  };
}

async function uploadBootstrapAssetToTos(
  settings: BootstrapSettings,
  env: Bindings,
  assetPath: string
): Promise<{ r2Key: string; r2Url: string; bytes: number }> {
  const root = getBootstrapAssetsRoot();
  if (!root) {
    throw new Error("Bootstrap assets root unavailable");
  }

  const absolutePath = resolveBootstrapAssetDiskPath(root, assetPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Bootstrap asset missing on server: ${assetPath}`);
  }

  const body = new Uint8Array(fs.readFileSync(absolutePath));
  const key = buildBootstrapR2ObjectKey(assetPath);
  const client = await createBootstrapTosClient(settings, env);
  await client.putObject({
    key,
    body,
    mimeType: contentTypeForBootstrapAsset(assetPath),
  });

  return {
    r2Key: key,
    r2Url: "",
    bytes: body.byteLength,
  };
}

async function uploadBootstrapAsset(
  settings: BootstrapSettings,
  env: Bindings,
  assetPath: string
): Promise<{ r2Key: string; r2Url: string; bytes: number }> {
  if (getBootstrapStorageProvider(settings) === "tos") {
    return uploadBootstrapAssetToTos(settings, env, assetPath);
  }
  return uploadBootstrapAssetToR2(settings, env, assetPath);
}

export async function syncBootstrapShellToR2(
  settings: BootstrapSettings,
  env: Bindings
): Promise<BootstrapSyncResult> {
  invalidateBootstrapAssetCache();

  const manifest = getBootstrapManifest();
  const root = getBootstrapAssetsRoot();

  if (!manifest || !root) {
    throw new Error(
      "Bootstrap manifest not found. Build the app and ensure dist/bootstrap-manifest.json is available to the API."
    );
  }

  if (!settings.r2Enabled) {
    throw new Error("Enable storage acceleration before syncing");
  }

  if (!isBootstrapStorageConfigured(settings)) {
    throw new Error(
      getBootstrapStorageProvider(settings) === "tos"
        ? "Complete TOS region, access key, secret, and bucket before syncing"
        : "Complete R2 credentials and public base URL before syncing"
    );
  }

  const shellUpload = await uploadBootstrapAsset(settings, env, manifest.shell);

  for (const pack of manifest.prefetchPacks ?? []) {
    await uploadBootstrapAsset(settings, env, pack.path);
  }

  for (const asset of manifest.staticAssets ?? []) {
    await uploadBootstrapAsset(settings, env, asset.path);
  }

  const storageLabel =
    getBootstrapStorageProvider(settings) === "tos" ? "TOS" : "R2";

  return {
    ok: true,
    shell: manifest.shell,
    shellHash: manifest.manifestVersion || manifest.shellHash,
    shellBytes: shellUpload.bytes,
    r2Key: shellUpload.r2Key,
    r2Url: shellUpload.r2Url,
    message: `Shell, ${manifest.prefetchPacks?.length ?? 0} prefetch pack(s), and ${manifest.staticAssets?.length ?? 0} static asset(s) synced to ${storageLabel}`,
  };
}

export function markBootstrapSyncResult(
  settings: BootstrapSettings,
  result: BootstrapSyncResult | null,
  errorMessage: string | null
): BootstrapSettings {
  if (result?.ok) {
    return {
      ...settings,
      lastSyncAt: new Date().toISOString(),
      lastSyncShellHash: result.shellHash,
      lastSyncError: null,
    };
  }

  return {
    ...settings,
    lastSyncError: errorMessage ?? "Sync failed",
  };
}
