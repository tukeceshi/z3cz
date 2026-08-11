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

  const shellFileName = manifest.shell.replace(/^\/assets\//, "");
  const shellPath = path.join(root, "assets", shellFileName);

  if (!fs.existsSync(shellPath)) {
    throw new Error(`Shell file missing on server: ${manifest.shell}`);
  }

  const body = new Uint8Array(fs.readFileSync(shellPath));
  const secretAccessKey = await resolveBootstrapR2SecretAccessKey(
    settings,
    env
  );
  const key = buildBootstrapR2ObjectKey(manifest.shell);

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

  const r2Url = buildBootstrapR2PublicUrl(
    settings.publicBaseUrl,
    manifest.shell
  );

  return {
    ok: true,
    shell: manifest.shell,
    shellHash: manifest.shellHash,
    shellBytes: body.byteLength,
    r2Key: key,
    r2Url,
    message: "Shell synced to R2",
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
