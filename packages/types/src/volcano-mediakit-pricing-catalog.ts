import type { VolcanoMediaKitVideoEnhanceMode } from "./volcano-mediakit-enhance";
import {
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES,
  VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES,
  type VolcanoMediaKitSubtitleEraseMode,
} from "./volcano-mediakit-enhance";

/** https://docs.volcengine.com/docs/6448/2486473 — ≤30fps tier */
export const VOLCANO_MEDIKIT_PRICING_DOC_URL =
  "https://docs.volcengine.com/docs/6448/2486473" as const;

export type VolcanoMediaKitPricingResolution =
  | "720P"
  | "1080P"
  | "2K"
  | "4K"
  | "8K";

export const VOLCANO_MEDIKIT_PRICING_RESOLUTIONS: readonly VolcanoMediaKitPricingResolution[] =
  ["720P", "1080P", "2K", "4K", "8K"] as const;

/** Yuan per minute at ≤30fps; null when the official doc has no tier. */
export type VolcanoMediaKitPricingRow = Readonly<
  Record<VolcanoMediaKitPricingResolution, number | null>
>;

export const VOLCANO_MEDIKIT_PRICING_TABLE: Readonly<
  Record<VolcanoMediaKitVideoEnhanceMode, VolcanoMediaKitPricingRow>
> = {
  fast: {
    "720P": 0.2,
    "1080P": 0.4,
    "2K": 0.8,
    "4K": 1.6,
    "8K": null,
  },
  standard: {
    "720P": 0.75,
    "1080P": 1.5,
    "2K": 3,
    "4K": 6,
    "8K": 24,
  },
  pro: {
    "720P": 7.5,
    "1080P": 15,
    "2K": 30,
    "4K": 60,
    "8K": 240,
  },
  llm: {
    "720P": 2.5,
    "1080P": 5,
    "2K": 10,
    "4K": null,
    "8K": null,
  },
};

/** Yuan per minute for full-segment subtitle erase. */
export const VOLCANO_MEDIKIT_SUBTITLE_ERASE_PRICING: Readonly<
  Record<VolcanoMediaKitSubtitleEraseMode, number>
> = {
  standard: 0.4,
  refined: 1,
};

export function formatMediaKitYuanPerSecond(yuanPerMinute: number): string {
  const yuanPerSecond = yuanPerMinute / 60;
  const formatted = yuanPerSecond.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
  return formatted;
}

export function listVolcanoMediaKitVideoEnhancePricingModes(): readonly VolcanoMediaKitVideoEnhanceMode[] {
  return VOLCANO_MEDIKIT_VIDEO_ENHANCE_MODES;
}

export function listVolcanoMediaKitSubtitleErasePricingModes(): readonly VolcanoMediaKitSubtitleEraseMode[] {
  return VOLCANO_MEDIKIT_SUBTITLE_ERASE_MODES;
}

/** @deprecated */
export function listVolcanoMediaKitPricingModes(): readonly VolcanoMediaKitVideoEnhanceMode[] {
  return listVolcanoMediaKitVideoEnhancePricingModes();
}
