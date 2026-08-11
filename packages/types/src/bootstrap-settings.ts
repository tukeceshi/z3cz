import { AUTH_CONFIG_SECRET_MASK } from "./auth-config";

export { AUTH_CONFIG_SECRET_MASK as BOOTSTRAP_SECRET_MASK };

export interface BootstrapSettings {
  r2Enabled: boolean;
  accountId: string;
  accessKeyId: string;
  secretAccessKeyEncrypted: string;
  bucketName: string;
  publicBaseUrl: string;
  lastSyncAt: string | null;
  lastSyncShellHash: string | null;
  lastSyncError: string | null;
}

export interface AdminBootstrapSettings {
  r2Enabled: boolean;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  secretAccessKeyConfigured: boolean;
  bucketName: string;
  publicBaseUrl: string;
  lastSyncAt: string | null;
  lastSyncShellHash: string | null;
  lastSyncError: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface UpdateBootstrapSettingsRequest {
  r2Enabled?: boolean;
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  publicBaseUrl?: string;
}

export interface BootstrapShellSource {
  readonly url: string;
  readonly kind: "origin" | "r2";
}

export interface BootstrapSyncResult {
  readonly ok: boolean;
  readonly shell: string;
  readonly shellHash: string;
  readonly shellBytes: number;
  readonly r2Key: string | null;
  readonly r2Url: string | null;
  readonly message: string;
}

export interface BootstrapConnectionTestResult {
  readonly ok: boolean;
  readonly message: string;
}

export const DEFAULT_BOOTSTRAP_SETTINGS: BootstrapSettings = {
  r2Enabled: false,
  accountId: "",
  accessKeyId: "",
  secretAccessKeyEncrypted: "",
  bucketName: "",
  publicBaseUrl: "",
  lastSyncAt: null,
  lastSyncShellHash: null,
  lastSyncError: null,
};

export function mergeBootstrapSettings(
  partial: Partial<BootstrapSettings> | null | undefined
): BootstrapSettings {
  const {
    shellEnabled: _legacyShellEnabled,
    multiSourceRaceEnabled: _legacyMultiSourceRaceEnabled,
    originBaseUrl: _legacyOriginBaseUrl,
    ...rest
  } = {
    ...(partial ?? {}),
  } as Partial<BootstrapSettings> & {
    shellEnabled?: boolean;
    multiSourceRaceEnabled?: boolean;
    originBaseUrl?: string;
  };

  return {
    ...DEFAULT_BOOTSTRAP_SETTINGS,
    ...rest,
  };
}
