import type { AiModelModality } from "./ai-model-catalog";
import type { OrgModelInstanceConfig } from "./org-model-instance";
import type { VolcanoSetupStatus } from "./volcano-setup";
import type { VolcanoModelActivationCacheEntry } from "./volcano-activation";
import type { VolcanoTosRegionPricingSnapshot } from "./volcano-tos-pricing";
import type {
  VolcanoPackageStatusBreakdown,
  VolcanoResourcePackageFetchMode,
  VolcanoResourcePackageRow,
} from "./volcano-resource-package-usage";

export type VolcanoApiKeyStatus =
  | "active"
  | "expiring_soon"
  | "expired"
  | "renew_failed";

/** @deprecated Alias for OrgModelInstanceConfig */
export type VolcanoModelConfig = OrgModelInstanceConfig;

export type VolcanoArkApiKeyScope = "endpoint" | "model";

export interface VolcanoPackageListCache {
  readonly fetchedAt: string;
  readonly mode: VolcanoResourcePackageFetchMode;
  readonly rows: readonly VolcanoResourcePackageRow[];
  readonly statusCounts: Readonly<Record<string, number>>;
}

/** Volcano TOS (object storage) — optional per AI interface. */
export interface VolcanoTosStorageConfig {
  readonly enabled: boolean;
  readonly bucket: string;
  readonly region: string;
  /** Root prefix inside bucket; default `z3cz`. */
  readonly prefix: string;
}

export interface VolcanoInterfaceMetadata {
  readonly credentialMode: "volcengine_iam";
  readonly accessKeyId: string;
  readonly secretAccessKeyEncrypted: string;
  readonly arkApiKeyExpiresAt?: string;
  /** True when create deferred Ark API key issuance (packages provisioned). */
  readonly arkApiKeyPending?: boolean;
  /** canonicalId -> ep-*; managed centrally for the whole interface. */
  readonly arkEndpoints?: Readonly<Record<string, string>>;
  /** Whether inference uses endpoint ids or provider ModelIds. */
  readonly arkApiKeyScope?: VolcanoArkApiKeyScope;
  readonly arkApiKeyDurationSeconds: number;
  readonly region: string;
  readonly models: Readonly<Record<string, VolcanoModelConfig>>;
  readonly modelActivationCache?: Readonly<
    Record<string, VolcanoModelActivationCacheEntry>
  >;
  readonly packageListCache?: VolcanoPackageListCache;
  /** ISO timestamps of successful billing package fetches (server rate limit). */
  readonly packageListRefreshLog?: readonly string[];
  readonly tosStorage?: VolcanoTosStorageConfig;
  /** Background provisioning after fast create. */
  readonly setupStatus?: VolcanoSetupStatus;
  readonly setupError?: string | null;
  readonly setupIdempotencyKey?: string;
}

/** TOS resource package usage (storage capacity or traffic). */
export interface VolcanoTosPackageUsage {
  readonly used: number;
  readonly remaining: number;
  readonly expired: number;
  readonly quota: number;
  readonly unit: "gb";
  readonly usagePercent: number;
  readonly overQuota: boolean;
  readonly packageStatus?: VolcanoPackageStatusBreakdown;
}

/** Cloud storage row in volcano snapshot (same level as models). */
export interface VolcanoTosStorageSnapshot {
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly region: string;
  readonly bucket: string;
  readonly prefix: string;
  readonly storageUsage: VolcanoTosPackageUsage | null;
  readonly trafficUsage: VolcanoTosPackageUsage | null;
  /** Whole-bucket stored object size from cloud monitor (GiB). */
  readonly bucketStorageGiB?: number;
  readonly bucketStorageError?: string;
  readonly pricing?: VolcanoTosRegionPricingSnapshot;
  readonly usageError?: string;
}

export interface VolcanoModelPackageSnapshot {
  readonly provisioned: boolean;
  readonly matchedCodes: readonly string[];
  readonly instanceNos: readonly string[];
  readonly configurationNames: readonly string[];
}

export interface VolcanoModelUsage {
  readonly used: number;
  readonly remaining: number;
  /** Unused amount forfeited when packages expired (not whole package total). */
  readonly expired: number;
  readonly quota: number;
  readonly unit: "tokens" | "images" | "seconds";
  readonly period: "package";
  readonly usagePercent: number;
  readonly overQuota: boolean;
  readonly packageStatus?: VolcanoPackageStatusBreakdown;
}

export interface VolcanoModelSnapshotRow {
  readonly canonicalId: string;
  readonly alias: string;
  readonly modality: AiModelModality;
  readonly providerModelId: string;
  readonly enabled: boolean;
  readonly usage: VolcanoModelUsage | null;
  readonly usageError?: string;
  readonly package?: VolcanoModelPackageSnapshot | null;
  readonly activation?: VolcanoModelActivationCacheEntry | null;
}

export interface VolcanoSnapshotPricingRow {
  readonly canonicalId: string;
  readonly alias: string;
  readonly modality: AiModelModality;
  readonly unitLabel: string;
  readonly priceLabel: string;
  readonly inputPriceLabel?: string;
  readonly outputPriceLabel?: string;
  readonly pricingNotes?: readonly string[];
}

export interface VolcanoSnapshotPricing {
  readonly docUrl: string;
  readonly effectiveDate: string;
  readonly rows: readonly VolcanoSnapshotPricingRow[];
}

export interface VolcanoSnapshotFetchResponse {
  readonly snapshot: VolcanoSnapshotResponse;
  readonly refreshLimited?: boolean;
  readonly nextRefreshAt?: string;
}

export interface VolcanoSnapshotResponse {
  readonly fetchedAt: string;
  readonly apiKey: {
    readonly masked: string;
    readonly expiresAt: string | null;
    readonly status: VolcanoApiKeyStatus;
  };
  readonly balance: {
    readonly available: string;
    readonly cash: string;
    readonly currency: "CNY";
  } | null;
  readonly balanceError?: string;
  readonly usageError?: string;
  readonly packageListCachedAt?: string;
  readonly pricing: VolcanoSnapshotPricing;
  readonly models: readonly VolcanoModelSnapshotRow[];
  readonly tosStorage?: VolcanoTosStorageSnapshot;
}
