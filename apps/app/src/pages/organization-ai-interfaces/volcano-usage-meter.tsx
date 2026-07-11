import type { VolcanoModelUsage } from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { formatVolcanoUsageAmount } from "./format-volcano-usage-amount";

interface VolcanoUsageMeterProps {
  readonly usage: VolcanoModelUsage;
}

function computeUsagePercents(usage: VolcanoModelUsage): {
  usedPercent: number;
  remainPercent: number;
  expiredPercent: number;
} {
  if (usage.quota <= 0) {
    return { usedPercent: 0, remainPercent: 0, expiredPercent: 0 };
  }

  const usedPercent = Math.round((usage.used / usage.quota) * 100);
  const remainPercent = Math.round((usage.remaining / usage.quota) * 100);
  const expiredPercent = Math.round((usage.expired / usage.quota) * 100);

  return { usedPercent, remainPercent, expiredPercent };
}

export function VolcanoUsageMeter({ usage }: VolcanoUsageMeterProps) {
  const { t, locale } = useTranslation();
  const showCappedBar = usage.quota > 0;

  if (!showCappedBar) {
    return (
      <p className="text-muted-foreground text-xs">
        {t("pages.aiInterfaces.volcano.meteredBillingOnly")}
      </p>
    );
  }

  const { usedPercent, remainPercent, expiredPercent } =
    computeUsagePercents(usage);
  const showExpiredSegment = usage.expired > 0;

  const tooltipText = showExpiredSegment
    ? t("pages.aiInterfaces.volcano.usageBarTooltipWithExpired", {
        usedPercent,
        remainPercent,
        expiredPercent,
      })
    : t("pages.aiInterfaces.volcano.usageBarTooltip", {
        usedPercent,
        remainPercent,
      });

  const formatAmount = (value: number) =>
    formatVolcanoUsageAmount(value, usage.unit, locale);

  return (
    <div className="space-y-1.5">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="bg-muted flex h-2.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={usedPercent}
              aria-label={tooltipText}
            >
              <div
                className="bg-muted-foreground/35 h-full transition-all"
                style={{ width: `${usedPercent}%` }}
              />
              {showExpiredSegment ? (
                <div
                  className="bg-destructive/40 h-full transition-all"
                  style={{ width: `${expiredPercent}%` }}
                />
              ) : null}
              <div
                className="bg-primary h-full transition-all"
                style={{ width: `${remainPercent}%` }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div
        className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs"
        aria-describedby="volcano-usage-details"
      >
        <span id="volcano-usage-details">
          {t("pages.aiInterfaces.volcano.packageUsed", {
            used: formatAmount(usage.used),
          })}
        </span>
        <span>
          {t("pages.aiInterfaces.volcano.packageExpired", {
            expired: formatAmount(usage.expired),
          })}
        </span>
        <span>
          {t("pages.aiInterfaces.volcano.packageRemaining", {
            remaining: formatAmount(usage.remaining),
          })}
        </span>
        <span>
          {t("pages.aiInterfaces.volcano.packageTotal", {
            total: formatAmount(usage.quota),
          })}
        </span>
      </div>

      {usage.overQuota ? (
        <p className="text-destructive text-xs">
          {t("pages.aiInterfaces.volcano.quotaExhausted")}
        </p>
      ) : null}
    </div>
  );
}
