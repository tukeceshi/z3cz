import type { VolcanoTosPackageUsage } from "@dafthunk/types";
import { computeUsageBarSegments } from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VolcanoTosUsageMeterProps {
  readonly label: string;
  readonly usage: VolcanoTosPackageUsage | null;
}

function formatGb(value: number, locale: string): string {
  return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} GB`;
}

export function VolcanoTosUsageMeter({ label, usage }: VolcanoTosUsageMeterProps) {
  const { t, locale } = useTranslation();

  if (!usage || usage.quota <= 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-muted-foreground text-xs">
          {t("pages.aiInterfaces.volcano.meteredBillingOnly")}
        </p>
      </div>
    );
  }

  const { usedPercent, remainPercent, expiredPercent } =
    computeUsageBarSegments(usage);
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

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="bg-muted flex h-2.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={remainPercent}
              aria-label={tooltipText}
            >
              <div
                className="bg-primary h-full transition-all"
                style={{ width: `${remainPercent}%` }}
              />
              {showExpiredSegment ? (
                <div
                  className="bg-amber-500/55 h-full transition-all"
                  style={{ width: `${expiredPercent}%` }}
                />
              ) : null}
              <div
                className="bg-muted-foreground/35 h-full transition-all"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <p className="text-muted-foreground text-xs">
        {t("pages.aiInterfaces.tosStorage.usageRemaining", {
          remaining: formatGb(usage.remaining, locale),
          total: formatGb(usage.quota, locale),
        })}
      </p>
    </div>
  );
}
