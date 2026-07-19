/** List prices aligned with https://www.volcengine.com/pricing?product=TOS&tab=1 */
export const VOLCANO_TOS_PRICING_DOC_URL =
  "https://www.volcengine.com/pricing?product=TOS&tab=1" as const;

export const VOLCANO_TOS_PRICING_EFFECTIVE_DATE = "2026-07-10" as const;

export interface VolcanoTosRegionPricingRow {
  readonly region: string;
  /** e.g. "0.099 元/GiB/月" */
  readonly standardStorageLabel: string;
  /** e.g. "0.50 元/GB" */
  readonly publicEgressLabel: string;
}

/** Per-region TOS list prices (standard storage capacity + public egress only). */
export const VOLCANO_TOS_REGION_PRICING: readonly VolcanoTosRegionPricingRow[] = [
  {
    region: "cn-guangzhou",
    standardStorageLabel: "0.099 元/GiB/月",
    publicEgressLabel: "0.50 元/GB",
  },
  {
    region: "cn-beijing",
    standardStorageLabel: "0.099 元/GiB/月",
    publicEgressLabel: "0.50 元/GB",
  },
  {
    region: "cn-shanghai",
    standardStorageLabel: "0.099 元/GiB/月",
    publicEgressLabel: "0.50 元/GB",
  },
  {
    region: "ap-southeast-1",
    standardStorageLabel: "0.136 元/GiB/月",
    publicEgressLabel: "0.75 元/GB",
  },
  {
    region: "ap-southeast-3",
    standardStorageLabel: "0.156 元/GiB/月",
    publicEgressLabel: "0.75 元/GB",
  },
] as const;

export interface VolcanoTosRegionPricingSnapshot {
  readonly docUrl: string;
  readonly standardStorageLabel: string;
  readonly publicEgressLabel: string;
}

export function volcanoTosPricingForRegion(
  region: string
): VolcanoTosRegionPricingSnapshot | null {
  const code = region.trim();
  if (!code) return null;

  const row = VOLCANO_TOS_REGION_PRICING.find((entry) => entry.region === code);
  if (!row) return null;

  return {
    docUrl: VOLCANO_TOS_PRICING_DOC_URL,
    standardStorageLabel: row.standardStorageLabel,
    publicEgressLabel: row.publicEgressLabel,
  };
}
