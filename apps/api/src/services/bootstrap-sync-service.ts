import type { BootstrapSettings, BootstrapSyncResult } from "@dafthunk/types";
import fs from "node:fs";
import path from "node:path";

import type { Bindings } from "../context";
import {
  getBootstrapAssetsRoot,
  getBootstrapManifest,
  invalidateBootstrapAssetCache,
} from "./bootstrap-asset-store";
import {
  buildBootstrapR2ObjectKey,
  buildBootstrapR2PublicUrl,
  uploadBootstrapShellToR2,
} from "./bootstrap-r2-client";
import {
  isBootstrapR2Configured,
  resolveBootstrapR2SecretAccessKey,
} from "./bootstrap-settings";

async function uploadBootstrapAssetToR2(
  settings: BootstrapSettings,
  env: Bindings,
  assetPath: string
): Promise<{ r2Key: string; r2Url: string; bytes: number }> {
  const root = getBootstrapAssetsRoot();
  if (!root) {
    throw new Error("Bootstrap assets root unavailable");
  }

  const fileName = assetPath.replace(/^\/assets\//, "");
  const absolutePath = path.join(root, "assets", fileName);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Bootstrap asset missing on server: ${assetPath}`);
  }

  const body = new Uint8Array(fs.readFileSync(absolutePath));
  const secretAccessKey = await resolveBootstrapR2SecretAccessKey(settings, env);
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
  });

  return {
    r2Key: key,
    r2Url: buildBootstrapR2PublicUrl(settings.publicBaseUrl, assetPath),
    bytes: body.byteLength,
  };
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
    throw new Error("Enable R2 acceleration before syncing");
  }

  if (!isBootstrapR2Configured(settings)) {
    throw new Error(
      "Complete R2 credentials and public base URL before syncing"
    );
  }

  const shellUpload = await uploadBootstrapAssetToR2(
    settings,
    env,
    manifest.shell
  );

  for (const pack of manifest.prefetchPacks ?? []) {
    await uploadBootstrapAssetToR2(settings, env, pack.path);
  }

  return {
    ok: true,
    shell: manifest.shell,
    shellHash: manifest.manifestVersion || manifest.shellHash,
    shellBytes: shellUpload.bytes,
    r2Key: shellUpload.r2Key,
    r2Url: shellUpload.r2Url,
    message: `Shell and ${manifest.prefetchPacks?.length ?? 0} prefetch pack(s) synced to R2`,
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
