import type { VolcanoModelUsage } from "@dafthunk/types";

import { computeUsageBarSegments } from "@dafthunk/types";



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

    computeUsageBarSegments(usage);

  const showExpiredSegment = usage.expired > 0;

  const packageStatus = usage.packageStatus;



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



      <div className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs">

        <span>

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



      {packageStatus &&

      (packageStatus.effectiveCount > 0 ||

        packageStatus.usedUpCount > 0 ||

        packageStatus.expiredCount > 0) ? (

        <div className="text-muted-foreground space-y-0.5 text-xs">

          {packageStatus.effectiveCount > 0 ? (

            <p>

              {t("pages.aiInterfaces.volcano.packageStatus.effective", {

                count: packageStatus.effectiveCount,

                remaining: formatAmount(packageStatus.effectiveRemaining),

              })}

            </p>

          ) : null}

          {packageStatus.usedUpCount > 0 ? (

            <p>

              {t("pages.aiInterfaces.volcano.packageStatus.usedUp", {

                count: packageStatus.usedUpCount,

                used: formatAmount(packageStatus.usedUpConsumed),

              })}

            </p>

          ) : null}

          {packageStatus.expiredCount > 0 ? (

            <p>

              {t("pages.aiInterfaces.volcano.packageStatus.expired", {

                count: packageStatus.expiredCount,

                expired: formatAmount(packageStatus.expiredUnused),

              })}

            </p>

          ) : null}

        </div>

      ) : null}



      {usage.overQuota ? (

        <p className="text-destructive text-xs">

          {t("pages.aiInterfaces.volcano.quotaExhausted")}

        </p>

      ) : null}

    </div>

  );

}

