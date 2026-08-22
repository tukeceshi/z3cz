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
  deleteRemoteBootstrapObject,
  fetchRemoteBootstrapManifest,
  putRemoteBootstrapManifest,
} from "./bootstrap-remote-storage";
import {
  getBootstrapStorageProvider,
  isBootstrapStorageConfigured,
  resolveBootstrapR2SecretAccessKey,
} from "./bootstrap-settings";
import { createBootstrapTosClient } from "./bootstrap-storage-sources";
import { planBootstrapSync } from "./bootstrap-sync-plan";

function readLocalAssetBytes(assetPath: string): Uint8Array {
  const root = getBootstrapAssetsRoot();
  if (!root) {
    throw new Error("Bootstrap assets root unavailable");
  }

  const absolutePath = resolveBootstrapAssetDiskPath(root, assetPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Bootstrap asset missing on server: ${assetPath}`);
  }

  return new Uint8Array(fs.readFileSync(absolutePath));
}

async function uploadBootstrapAssetToR2(
  settings: BootstrapSettings,
  env: Bindings,
  assetPath: string
): Promise<{ r2Key: string; r2Url: string; bytes: number }> {
  const body = readLocalAssetBytes(assetPath);
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
  const body = readLocalAssetBytes(assetPath);
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

function buildSyncMessage(
  storageLabel: string,
  uploadedCount: number,
  skippedCount: number,
  prunedCount: number,
  upToDate: boolean
): string {
  if (upToDate) {
    return `${storageLabel} already up to date (${skippedCount} skipped)`;
  }
  return `${storageLabel} sync complete: ${uploadedCount} uploaded, ${skippedCount} skipped, ${prunedCount} pruned`;
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

  const remoteManifest = await fetchRemoteBootstrapManifest(settings, env);
  const plan = planBootstrapSync(manifest, remoteManifest);
  const storageLabel =
    getBootstrapStorageProvider(settings) === "tos" ? "TOS" : "R2";

  if (plan.upToDate) {
    const shellBytes = readLocalAssetBytes(manifest.shell).byteLength;
    return {
      ok: true,
      shell: manifest.shell,
      shellHash: manifest.manifestVersion || manifest.shellHash,
      shellBytes,
      r2Key: buildBootstrapR2ObjectKey(manifest.shell),
      r2Url:
        getBootstrapStorageProvider(settings) === "r2"
          ? buildBootstrapR2PublicUrl(settings.publicBaseUrl, manifest.shell)
          : null,
      uploadedCount: 0,
      skippedCount: plan.skippedCount,
      prunedCount: 0,
      message: buildSyncMessage(storageLabel, 0, plan.skippedCount, 0, true),
    };
  }

  let shellUpload: { r2Key: string; r2Url: string; bytes: number } | null =
    null;
  for (const assetPath of plan.toUpload) {
    const upload = await uploadBootstrapAsset(settings, env, assetPath);
    if (assetPath === manifest.shell) {
      shellUpload = upload;
    }
  }

  for (const key of plan.toPruneKeys) {
    await deleteRemoteBootstrapObject(settings, env, key);
  }

  await putRemoteBootstrapManifest(settings, env, manifest);

  const shellBytes = readLocalAssetBytes(manifest.shell).byteLength;
  const shellKey = buildBootstrapR2ObjectKey(manifest.shell);

  return {
    ok: true,
    shell: manifest.shell,
    shellHash: manifest.manifestVersion || manifest.shellHash,
    shellBytes: shellUpload?.bytes ?? shellBytes,
    r2Key: shellUpload?.r2Key ?? shellKey,
    r2Url:
      getBootstrapStorageProvider(settings) === "r2"
        ? (shellUpload?.r2Url ??
          buildBootstrapR2PublicUrl(settings.publicBaseUrl, manifest.shell))
        : null,
    uploadedCount: plan.toUpload.length,
    skippedCount: plan.skippedCount,
    prunedCount: plan.toPruneKeys.length,
    message: buildSyncMessage(
      storageLabel,
      plan.toUpload.length,
      plan.skippedCount,
      plan.toPruneKeys.length,
      false
    ),
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
