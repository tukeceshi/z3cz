import type {
  AdminBootstrapSettings,
  BootstrapSettings,
  BootstrapShellSource,
  BootstrapStorageProvider,
  UpdateBootstrapSettingsRequest,
} from "@dafthunk/types";
import {
  AUTH_CONFIG_SECRET_MASK,
  mergeBootstrapSettings,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import {
  decryptSecret,
  encryptSecret,
  PLATFORM_ENCRYPTION_SCOPE,
} from "../utils/encryption";
import { getBootstrapManifest } from "./bootstrap-asset-store";
import { buildBootstrapR2PublicUrl } from "./bootstrap-r2-client";

export function parseBootstrapSettings(
  value: string | null | undefined
): BootstrapSettings {
  if (!value) {
    return mergeBootstrapSettings(null);
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return mergeBootstrapSettings(null);
    }
    return mergeBootstrapSettings(parsed as Partial<BootstrapSettings>);
  } catch {
    return mergeBootstrapSettings(null);
  }
}

export function serializeBootstrapSettings(config: BootstrapSettings): string {
  return JSON.stringify(mergeBootstrapSettings(config));
}

export async function decryptBootstrapSecret(
  encrypted: string,
  env: Bindings
): Promise<string> {
  if (!encrypted.trim()) {
    return "";
  }
  return decryptSecret(encrypted, env, PLATFORM_ENCRYPTION_SCOPE);
}

export async function encryptBootstrapSecret(
  plaintext: string,
  env: Bindings
): Promise<string> {
  if (!plaintext.trim()) {
    return "";
  }
  return encryptSecret(plaintext, env, PLATFORM_ENCRYPTION_SCOPE);
}

export function getBootstrapStorageProvider(
  settings: BootstrapSettings
): BootstrapStorageProvider {
  return settings.storageProvider === "tos" ? "tos" : "r2";
}

export function isBootstrapR2Configured(settings: BootstrapSettings): boolean {
  return (
    settings.accountId.trim().length > 0 &&
    settings.accessKeyId.trim().length > 0 &&
    settings.secretAccessKeyEncrypted.trim().length > 0 &&
    settings.bucketName.trim().length > 0 &&
    settings.publicBaseUrl.trim().length > 0
  );
}

export function isBootstrapTosConfigured(settings: BootstrapSettings): boolean {
  return (
    settings.tosRegion.trim().length > 0 &&
    settings.tosAccessKeyId.trim().length > 0 &&
    settings.tosSecretAccessKeyEncrypted.trim().length > 0 &&
    settings.tosBucketName.trim().length > 0
  );
}

export function isBootstrapStorageConfigured(
  settings: BootstrapSettings
): boolean {
  if (getBootstrapStorageProvider(settings) === "tos") {
    return isBootstrapTosConfigured(settings);
  }
  return isBootstrapR2Configured(settings);
}

export function currentBootstrapManifestVersion(): string | null {
  const manifest = getBootstrapManifest();
  if (!manifest) {
    return null;
  }
  const version = manifest.manifestVersion || manifest.shellHash;
  return version.trim().length > 0 ? version : null;
}

export function isBootstrapStorageSynced(
  settings: BootstrapSettings,
  currentVersion: string | null
): boolean {
  return Boolean(
    currentVersion &&
      settings.lastSyncShellHash &&
      settings.lastSyncShellHash === currentVersion
  );
}

export function canUseStorageOnly(
  settings: BootstrapSettings,
  currentVersion: string | null
): boolean {
  return (
    settings.r2Enabled &&
    isBootstrapStorageConfigured(settings) &&
    isBootstrapStorageSynced(settings, currentVersion)
  );
}

export function shouldUseStorageOnly(
  settings: BootstrapSettings,
  currentVersion: string | null
): boolean {
  return settings.r2Only && canUseStorageOnly(settings, currentVersion);
}

export function disableStaleStorageOnly(
  settings: BootstrapSettings,
  currentVersion: string | null
): { settings: BootstrapSettings; changed: boolean } {
  if (!settings.r2Only) {
    return { settings, changed: false };
  }
  if (canUseStorageOnly(settings, currentVersion)) {
    return { settings, changed: false };
  }
  return {
    settings: { ...settings, r2Only: false },
    changed: true,
  };
}

export async function resolveBootstrapR2SecretAccessKey(
  settings: BootstrapSettings,
  env: Bindings
): Promise<string> {
  if (!settings.secretAccessKeyEncrypted.trim()) {
    return "";
  }
  return decryptBootstrapSecret(settings.secretAccessKeyEncrypted, env);
}

export function toAdminBootstrapSettings(
  settings: BootstrapSettings,
  updatedAt: string,
  updatedBy: string | null,
  currentVersion: string | null = currentBootstrapManifestVersion()
): AdminBootstrapSettings {
  return {
    r2Enabled: settings.r2Enabled,
    r2Only: settings.r2Only,
    storageOnlyAllowed: canUseStorageOnly(settings, currentVersion),
    storageProvider: getBootstrapStorageProvider(settings),
    accountId: settings.accountId,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKeyEncrypted.trim()
      ? AUTH_CONFIG_SECRET_MASK
      : "",
    secretAccessKeyConfigured:
      settings.secretAccessKeyEncrypted.trim().length > 0,
    bucketName: settings.bucketName,
    publicBaseUrl: settings.publicBaseUrl,
    tosRegion: settings.tosRegion,
    tosAccessKeyId: settings.tosAccessKeyId,
    tosSecretAccessKey: settings.tosSecretAccessKeyEncrypted.trim()
      ? AUTH_CONFIG_SECRET_MASK
      : "",
    tosSecretAccessKeyConfigured:
      settings.tosSecretAccessKeyEncrypted.trim().length > 0,
    tosBucketName: settings.tosBucketName,
    lastSyncAt: settings.lastSyncAt,
    lastSyncShellHash: settings.lastSyncShellHash,
    lastSyncError: settings.lastSyncError,
    updatedAt,
    updatedBy,
  };
}

export function mergeBootstrapSettingsUpdate(
  existing: BootstrapSettings,
  input: UpdateBootstrapSettingsRequest
): BootstrapSettings {
  const previousProvider = getBootstrapStorageProvider(existing);
  const next = mergeBootstrapSettings(existing);

  if (input.r2Enabled !== undefined) {
    next.r2Enabled = input.r2Enabled;
  }
  if (input.r2Only !== undefined) {
    next.r2Only = input.r2Only;
  }
  if (input.storageProvider !== undefined) {
    next.storageProvider = input.storageProvider === "tos" ? "tos" : "r2";
  }
  if (!next.r2Enabled) {
    next.r2Only = false;
  }
  if (input.accountId !== undefined) {
    next.accountId = input.accountId.trim();
  }
  if (input.accessKeyId !== undefined) {
    next.accessKeyId = input.accessKeyId.trim();
  }
  if (input.bucketName !== undefined) {
    next.bucketName = input.bucketName.trim();
  }
  if (input.publicBaseUrl !== undefined) {
    next.publicBaseUrl = input.publicBaseUrl.trim();
  }
  if (input.tosRegion !== undefined) {
    next.tosRegion = input.tosRegion.trim();
  }
  if (input.tosAccessKeyId !== undefined) {
    next.tosAccessKeyId = input.tosAccessKeyId.trim();
  }
  if (input.tosBucketName !== undefined) {
    next.tosBucketName = input.tosBucketName.trim();
  }
  if (getBootstrapStorageProvider(next) !== previousProvider) {
    next.lastSyncAt = null;
    next.lastSyncShellHash = null;
    next.lastSyncError = null;
    next.r2Only = false;
  }

  return next;
}

export async function applyBootstrapSecretUpdate(
  existing: BootstrapSettings,
  input: UpdateBootstrapSettingsRequest,
  env: Bindings
): Promise<BootstrapSettings> {
  const next = mergeBootstrapSettingsUpdate(existing, input);

  if (
    input.secretAccessKey !== undefined &&
    input.secretAccessKey !== AUTH_CONFIG_SECRET_MASK &&
    input.secretAccessKey.trim().length > 0
  ) {
    next.secretAccessKeyEncrypted = await encryptBootstrapSecret(
      input.secretAccessKey.trim(),
      env
    );
  }

  if (
    input.tosSecretAccessKey !== undefined &&
    input.tosSecretAccessKey !== AUTH_CONFIG_SECRET_MASK &&
    input.tosSecretAccessKey.trim().length > 0
  ) {
    next.tosSecretAccessKeyEncrypted = await encryptBootstrapSecret(
      input.tosSecretAccessKey.trim(),
      env
    );
  }

  return next;
}

export function applyStorageOnlyUpdateGuards(
  settings: BootstrapSettings,
  input: UpdateBootstrapSettingsRequest,
  currentVersion: string | null
): BootstrapSettings {
  if (input.r2Only === true) {
    return settings;
  }
  if (canUseStorageOnly(settings, currentVersion)) {
    return settings;
  }
  if (!settings.r2Only) {
    return settings;
  }
  return { ...settings, r2Only: false };
}

export async function resolveBootstrapTosSecretAccessKey(
  settings: BootstrapSettings,
  env: Bindings
): Promise<string> {
  if (!settings.tosSecretAccessKeyEncrypted.trim()) {
    return "";
  }
  return decryptBootstrapSecret(settings.tosSecretAccessKeyEncrypted, env);
}

export function validateBootstrapSettingsUpdate(
  settings: BootstrapSettings,
  currentVersion: string | null = currentBootstrapManifestVersion()
): void {
  if (settings.r2Enabled && !isBootstrapStorageConfigured(settings)) {
    throw new Error(
      getBootstrapStorageProvider(settings) === "tos"
        ? "TOS acceleration requires region, access key, secret, and bucket"
        : "R2 acceleration requires account ID, access key, secret, bucket, and public base URL"
    );
  }
  if (!settings.r2Only) {
    return;
  }
  if (!settings.r2Enabled || !isBootstrapStorageConfigured(settings)) {
    throw new Error(
      "Storage-only acceleration requires storage to be enabled and configured"
    );
  }
  if (!isBootstrapStorageSynced(settings, currentVersion)) {
    throw new Error(
      "Sync the current build before enabling storage-only acceleration"
    );
  }
}

export function buildBootstrapShellSources(
  assetPath: string,
  settings: BootstrapSettings,
  currentVersion: string | null = currentBootstrapManifestVersion(),
  storageByPath?: ReadonlyMap<string, BootstrapShellSource>
): BootstrapShellSource[] {
  const origin: BootstrapShellSource = { url: assetPath, kind: "origin" };
  if (!settings.r2Enabled || !isBootstrapStorageConfigured(settings)) {
    return [origin];
  }

  const mapped = storageByPath?.get(assetPath);
  const storage: BootstrapShellSource | null =
    mapped ??
    (getBootstrapStorageProvider(settings) === "r2" &&
    isBootstrapR2Configured(settings)
      ? {
          url: buildBootstrapR2PublicUrl(settings.publicBaseUrl, assetPath),
          kind: "r2",
        }
      : null);

  if (!storage) {
    return [origin];
  }

  if (shouldUseStorageOnly(settings, currentVersion)) {
    return [storage];
  }

  return [origin, storage];
}
