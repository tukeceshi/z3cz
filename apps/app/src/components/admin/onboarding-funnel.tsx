import CheckCircle2 from "lucide-react/icons/check-circle-2";
import Circle from "lucide-react/icons/circle";

import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOnboardingStageLabel } from "@/i18n/admin-labels";
import {
  type AdminUserExecutionsSummary,
  type AdminUserFunnel,
  type AdminUserFunnelStage,
  ONBOARDING_STAGES,
  type OnboardingStage,
} from "@/services/admin-service";
import { cn } from "@/utils/utils";

interface OnboardingFunnelProps {
  funnel: AdminUserFunnel | null;
  isFunnelLoading: boolean;
  executionsSummary: AdminUserExecutionsSummary | null;
  isExecutionsSummaryLoading: boolean;
}

interface StageRow {
  key: OnboardingStage;
  description: string;
  stage: AdminUserFunnelStage;
}

function formatStageTimestamp(at: Date | null): string {
  if (!at) return "—";
  try {
    return new Date(at).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(at);
  }
}

function pickStage(
  funnel: AdminUserFunnel,
  key: OnboardingStage
): AdminUserFunnelStage {
  switch (key) {
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

export function OnboardingFunnel({
  funnel,
  isFunnelLoading,
  executionsSummary,
  isExecutionsSummaryLoading,
}: OnboardingFunnelProps) {
  const { t } = useTranslation();

  if (isFunnelLoading || !funnel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.userDetail.funnel.title")}</CardTitle>
          <CardDescription>
            {t("admin.userDetail.funnel.loadingDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ONBOARDING_STAGES.map((stage) => (
            <div key={stage} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const loadingExecutions = t("admin.userDetail.funnel.loadingExecutions");
  const executionsDescription = executionsSummary
    ? t("admin.userDetail.funnel.totalExecutions", {
        count: executionsSummary.totalExecutions,
      })
    : isExecutionsSummaryLoading
      ? loadingExecutions
      : "—";
  const successDescription = executionsSummary
    ? t("admin.userDetail.funnel.successBreakdown", {
        success: executionsSummary.successCount,
        failed: executionsSummary.errorCount,
      })
    : isExecutionsSummaryLoading
      ? loadingExecutions
      : "—";

  const descriptions: Record<OnboardingStage, string> = {
    signed_up: t("admin.userDetail.funnel.signedUpDesc"),
    tour_completed: t("admin.userDetail.funnel.tourCompletedDesc"),
    workflow_created: t("admin.userDetail.funnel.workflowCreatedDesc"),
    workflow_executed: executionsDescription,
    workflow_executed_ok: successDescription,
  };

  const stages: StageRow[] = ONBOARDING_STAGES.map((key) => ({
    key,
    description: descriptions[key],
    stage: pickStage(funnel, key),
  }));

  const furthestReachedIndex = (() => {
    let last = -1;
    for (let i = 0; i < stages.length; i++) {
      if (stages[i].stage.reached) last = i;
    }
    return last;
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.userDetail.funnel.title")}</CardTitle>
        <CardDescription>{t("admin.userDetail.funnel.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {stages.map((row, index) => {
            const isFurthest = index === furthestReachedIndex;
            const Icon = row.stage.reached ? CheckCircle2 : Circle;
            const days = funnel.daysSinceAdvance;

            return (
              <li key={row.key} className="flex items-start gap-3">
                <Icon
                  className={cn(
                    "h-5 w-5 mt-0.5 shrink-0",
                    row.stage.reached
                      ? "text-emerald-600"
                      : "text-muted-foreground/40"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        !row.stage.reached && "text-muted-foreground"
                      )}
                    >
                      {getOnboardingStageLabel(t, row.key)}
                    </span>
                    {isFurthest && days > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {days === 1
                          ? t("admin.userDetail.funnel.dayAtStage", {
                              count: days,
                            })
                          : t("admin.userDetail.funnel.daysAtStage", {
                              count: days,
                            })}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.description}
                  </div>
                  {row.stage.reached && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatStageTimestamp(row.stage.at)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
