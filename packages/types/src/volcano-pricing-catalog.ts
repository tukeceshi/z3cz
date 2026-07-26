import type { AiModelModality } from "./ai-model-catalog";

/** Pricing snapshot aligned with https://docs.volcengine.com/docs/82379/1544106 */
export const VOLCANO_PRICING_EFFECTIVE_DATE = "2026-07-10" as const;

export interface VolcanoModelPricingRow {
  readonly canonicalId: string;
  readonly alias: string;
  readonly modality: AiModelModality;
  readonly unitLabel: string;
  readonly priceLabel: string;
  readonly inputPriceLabel?: string;
  readonly outputPriceLabel?: string;
  readonly pricingNotes?: readonly string[];
  /** Per-model monthly free quota for progress display */
  readonly monthlyFreeQuota: number | null;
}

export const VOLCANO_MODEL_PRICING_CATALOG: readonly VolcanoModelPricingRow[] = [
  {
    canonicalId: "doubao-seed-evolving",
    alias: "Doubao Seed Evolving",
    modality: "text",
    unitLabel: "元/百万 tokens",
    priceLabel: "按输入/输出分别计费",
    inputPriceLabel: "输入 0.80",
    outputPriceLabel: "输出 2.00",
    monthlyFreeQuota: 500_000,
  },
  {
    canonicalId: "deepseek-v4-pro",
    alias: "DeepSeek V4 Pro",
    modality: "text",
    unitLabel: "元/百万 tokens",
    priceLabel: "按输入/输出分别计费",
    inputPriceLabel: "输入 2.00",
    outputPriceLabel: "输出 8.00",
    monthlyFreeQuota: 500_000,
  },
  {
    canonicalId: "deepseek-v4-flash",
    alias: "DeepSeek V4 Flash",
    modality: "text",
    unitLabel: "元/百万 tokens",
    priceLabel: "按输入/输出分别计费",
    inputPriceLabel: "输入 0.20",
    outputPriceLabel: "输出 0.80",
    monthlyFreeQuota: 500_000,
  },
  {
    canonicalId: "glm-5-2",
    alias: "GLM-5.2",
    modality: "text",
    unitLabel: "元/百万 tokens",
    priceLabel: "按量计费",
    pricingNotes: ["价格以火山引擎官网为准"],
    monthlyFreeQuota: 500_000,
  },
  {
    canonicalId: "doubao-seedance-2",
    alias: "Seedance 2.0",
    modality: "video",
    unitLabel: "元/百万 tokens",
    priceLabel: "按实际输出 tokens 计费",
    pricingNotes: [
      "不含视频输入（文/图生视频）：46 元/百万 tokens",
      "含视频输入（视频编辑）：28 元/百万 tokens",
      "无固定「元/秒」单价；720P/15s 约 30 万 tokens",
    ],
    monthlyFreeQuota: null,
  },
  {
    canonicalId: "doubao-seedance-2-fast",
    alias: "Seedance 2.0 Fast",
    modality: "video",
    unitLabel: "元/百万 tokens",
    priceLabel: "按实际输出 tokens 计费（低于标准版）",
    pricingNotes: [
      "不含视频输入：单价低于标准版",
      "含视频输入：单价低于标准版",
      "最高 720P，不支持 1080P",
    ],
    monthlyFreeQuota: null,
  },
  {
    canonicalId: "doubao-seedance-2-mini",
    alias: "Seedance 2.0 Mini",
    modality: "video",
    unitLabel: "元/千 tokens",
    priceLabel: "按实际输出 tokens 计费",
    pricingNotes: [
      "图生视频：0.023 元/千 tokens",
      "视频生视频：0.014 元/千 tokens",
      "适合电商/营销批量生成",
    ],
    monthlyFreeQuota: null,
  },
  {
    canonicalId: "doubao-seedream-5",
    alias: "Seedream 5.0",
    modality: "image",
    unitLabel: "元/张",
    priceLabel: "0.20",
    monthlyFreeQuota: 200,
  },
] as const;

export function getVolcanoPricingForCanonicalId(
  canonicalId: string
): VolcanoModelPricingRow | null {
  return (
    VOLCANO_MODEL_PRICING_CATALOG.find(
      (row) => row.canonicalId === canonicalId
    ) ?? null
  );
}

export function buildVolcanoFreeQuotaByCanonicalId(): Record<
  string,
  number | null
> {
  return Object.fromEntries(
    VOLCANO_MODEL_PRICING_CATALOG.map((row) => [
      row.canonicalId,
      row.monthlyFreeQuota,
    ])
  );
}
