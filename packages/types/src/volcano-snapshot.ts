import type { AiModelModality } from "./ai-model-catalog";
import type { VolcanoModelActivationCacheEntry } from "./volcano-activation";

export type VolcanoApiKeyStatus =
  | "active"
  | "expiring_soon"
  | "expired"
  | "renew_failed";

export interface VolcanoModelConfig {
  readonly enabled: boolean;
  readonly providerModelId: string;
  readonly modality: AiModelModality;
}

export interface VolcanoInterfaceMetadata {
  readonly credentialMode: "volcengine_iam";
  readonly accessKeyId: string;
  readonly secretAccessKeyEncrypted: string;
  readonly arkApiKeyExpiresAt?: string;
  readonly arkApiKeyDurationSeconds: number;
  readonly region: string;
  readonly models: Readonly<Record<string, VolcanoModelConfig>>;
  readonly modelActivationCache?: Readonly<
    Record<string, VolcanoModelActivationCacheEntry>
  >;
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
  readonly expired: number;
  readonly quota: number;
  readonly unit: "tokens" | "images" | "seconds";
  readonly period: "package";
  readonly usagePercent: number;
  readonly overQuota: boolean;
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
  readonly pricing: VolcanoSnapshotPricing;
  readonly models: readonly VolcanoModelSnapshotRow[];
}
