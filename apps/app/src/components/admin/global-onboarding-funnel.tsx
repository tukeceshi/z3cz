import type { AdminStatsFunnel, OnboardingStage } from "@/services/admin-service";
import { ONBOARDING_STAGES } from "@/services/admin-service";

import { useTranslation } from "@/components/locale-provider";
import { getOnboardingStageLabel } from "@/i18n/admin-labels";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

function getCount(funnel: AdminStatsFunnel, stage: OnboardingStage): number {
  switch (stage) {
    case "signed_up":
      return funnel.signedUp;
    case "tour_completed":
      return funnel.tourCompleted;
    case "workflow_created":
      return funnel.workflowCreated;
    case "workflow_executed":
      return funnel.workflowExecuted;
    case "workflow_executed_ok":
      return funnel.workflowExecutedOk;
  }
}

export function GlobalOnboardingFunnel({
  funnel,
}: {
  funnel: AdminStatsFunnel;
}) {
  const { t } = useTranslation();
  const total = funnel.signedUp;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.funnel.title")}</CardTitle>
        <CardDescription>{t("admin.funnel.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ONBOARDING_STAGES.map((stage, index) => {
            const count = getCount(funnel, stage);
            const percentOfTotal = total > 0 ? (count / total) * 100 : 0;
            const previousCount =
              index === 0
                ? count
                : getCount(funnel, ONBOARDING_STAGES[index - 1]);
            const conversion =
              previousCount > 0 ? (count / previousCount) * 100 : 0;

            return (
              <div key={stage} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">
                    {getOnboardingStageLabel(t, stage)}
                  </span>
                  <span className="text-muted-foreground">
                    {count.toLocaleString()}
                    <span className="ml-2 text-xs">
                      (
                      {t("admin.funnel.percentOfSignups", {
                        percent: percentOfTotal.toFixed(1),
                      })}
                      {index > 0 &&
                        t("admin.funnel.fromPrevious", {
                          percent: conversion.toFixed(1),
                        })}
                      )
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, percentOfTotal)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
