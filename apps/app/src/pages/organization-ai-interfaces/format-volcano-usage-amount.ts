import type { AppLocale } from "@dafthunk/types";

const MILLION = 1_000_000;

export function formatVolcanoUsageAmount(
  value: number,
  unit: "tokens" | "images" | "seconds",
  locale: AppLocale
): string {
  if (unit === "images") {
    const label = locale === "zh" ? "张" : "images";
    return `${value.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")} ${label}`;
  }

  if (unit === "seconds") {
    const label = locale === "zh" ? "秒" : "seconds";
    return `${value.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")} ${label}`;
  }

  if (Math.abs(value) >= MILLION) {
    const millions = value / MILLION;
    const formatted = millions.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    return locale === "zh"
      ? `${formatted} 百万 tokens`
      : `${formatted}M tokens`;
  }

  return `${value.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")} tokens`;
}
