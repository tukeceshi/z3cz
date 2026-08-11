import type {
  AdminBootstrapSettings,
  BootstrapSettings,
  BootstrapShellSource,
  UpdateBootstrapSettingsRequest,
} from "@dafthunk/types";
import {
  AUTH_CONFIG_SECRET_MASK,
  DEFAULT_BOOTSTRAP_SETTINGS,
  mergeBootstrapSettings,
} from "@dafthunk/types";

import type { Bindings } from "../context";
import {
  decryptSecret,
  encryptSecret,
  PLATFORM_ENCRYPTION_SCOPE,
} from "../utils/encryption";

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

export function isBootstrapR2Configured(settings: BootstrapSettings): boolean {
  return (
    settings.accountId.trim().length > 0 &&
    settings.accessKeyId.trim().length > 0 &&
    settings.secretAccessKeyEncrypted.trim().length > 0 &&
    settings.bucketName.trim().length > 0 &&
    settings.publicBaseUrl.trim().length > 0
  );
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
  updatedBy: string | null
): AdminBootstrapSettings {
  return {
    r2Enabled: settings.r2Enabled,
    accountId: settings.accountId,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKeyEncrypted.trim()
      ? AUTH_CONFIG_SECRET_MASK
      : "",
    secretAccessKeyConfigured:
      settings.secretAccessKeyEncrypted.trim().length > 0,
    bucketName: settings.bucketName,
    publicBaseUrl: settings.publicBaseUrl,
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
  const next = mergeBootstrapSettings(existing);

  if (input.r2Enabled !== undefined) {
    next.r2Enabled = input.r2Enabled;
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

  return next;
}

export function validateBootstrapSettingsUpdate(
  settings: BootstrapSettings
): void {
  if (settings.r2Enabled && !isBootstrapR2Configured(settings)) {
    throw new Error(
      "R2 acceleration requires account ID, access key, secret, bucket, and public base URL"
    );
  }
}

export function buildBootstrapShellSources(
  shellPath: string,
  settings: BootstrapSettings
): BootstrapShellSource[] {
  const sources: BootstrapShellSource[] = [
    { url: shellPath, kind: "origin" },
  ];

  if (settings.r2Enabled && isBootstrapR2Configured(settings)) {
    const fileName = shellPath.replace(/^\/assets\//, "");
    const publicBase = settings.publicBaseUrl.trim().replace(/\/$/, "");
    sources.push({
      url: `${publicBase}/${fileName}`,
      kind: "r2",
    });
  }

  return sources;
}
