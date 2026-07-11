import type {
  CreateWorkflowRequest,
  WorkflowRuntime,
  WorkflowTrigger,
} from "@dafthunk/types";
import Logs from "lucide-react/icons/logs";
import Plug from "lucide-react/icons/plug";
import Workflow from "lucide-react/icons/workflow";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/components/auth-context";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateWorkflowDialog } from "@/components/workflow/create-workflow-dialog";
import { buildInitialTriggerNodes } from "@/components/workflow/trigger-node-mapping";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import { useBilling } from "@/services/billing-service";
import { useDashboard } from "@/services/dashboard-service";
import { useNodeTypes } from "@/services/type-service";
import { createWorkflow, useWorkflows } from "@/services/workflow-service";
import { useOrganizationAiInterfaces } from "@/services/organization-ai-interface-service";

const AI_SETUP_DISMISS_KEY = "dafthunk:dashboard-ai-setup-dismissed";

export function DashboardPage() {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { dashboardStats, dashboardStatsError, isDashboardStatsLoading } =
    useDashboard();
  const { billing, billingError, isBillingLoading } = useBilling();
  const { getOrgUrl } = useOrgUrl();
  const { organization } = useAuth();
  const orgId = organization?.id || "";
  const { mutateWorkflows } = useWorkflows();
  const { nodeTypes } = useNodeTypes(undefined, { revalidateOnFocus: false });
  const { interfaces, isInterfacesLoading } = useOrganizationAiInterfaces(orgId || undefined);
  const [setupDismissed, setSetupDismissed] = useState(() => {
    if (!orgId) return false;
    try {
      return localStorage.getItem(`${AI_SETUP_DISMISS_KEY}:${orgId}`) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.dashboard") }]);
  }, [setBreadcrumbs, t]);

  const handleCreateWorkflow = async (
    schemeId: string,
    name: string,
    trigger: WorkflowTrigger,
    description?: string,
    runtime?: WorkflowRuntime
  ) => {
    if (!orgId) return;

    try {
      const initialNodes = buildInitialTriggerNodes(trigger, nodeTypes || []);
      const request: CreateWorkflowRequest = {
        name,
        description,
        schemeId,
        trigger,
        runtime,
        nodes: initialNodes,
        edges: [],
      };

      const newWorkflow = await createWorkflow(request, orgId);

      mutateWorkflows();
      navigate(getOrgUrl(`workflows/${newWorkflow.id}`));
    } catch (error) {
      console.error("Failed to create workflow:", error);
    }
  };

  if (isDashboardStatsLoading || isBillingLoading || isInterfacesLoading) {
    return <InsetLoading title={t("pages.dashboard.title")} />;
  } else if (dashboardStatsError || billingError) {
    return (
      <InsetError
        title={t("pages.dashboard.title")}
        errorMessage={
          dashboardStatsError?.message ||
          billingError?.message ||
          t("common.errorOccurred")
        }
      />
    );
  }

  if (!dashboardStats) {
    return (
      <InsetLayout title={t("pages.dashboard.title")}>
        <div className="flex flex-1 items-center justify-center">
          {t("pages.dashboard.noData")}
        </div>
      </InsetLayout>
    );
  }

  const isPro = billing?.plan === "pro";
  const usageThisPeriod = billing?.usageThisPeriod ?? 0;
  const includedCredits = billing?.includedCredits ?? 0;
  const usagePercent = includedCredits
    ? Math.min(100, (usageThisPeriod / includedCredits) * 100)
    : 0;
  const hasOverageLimit = billing?.overageLimit != null;
  const currentOverage = Math.max(0, usageThisPeriod - includedCredits);
  const isOverageAtLimit =
    hasOverageLimit && currentOverage >= billing!.overageLimit!;

  const showAiSetupBanner =
    interfaces.length === 0 && !setupDismissed;

  const dismissAiSetupBanner = () => {
    setSetupDismissed(true);
    if (!orgId) return;
    try {
      localStorage.setItem(`${AI_SETUP_DISMISS_KEY}:${orgId}`, "1");
    } catch {
      // ignore
    }
  };

  return (
    <InsetLayout title={t("pages.dashboard.title")}>
      {showAiSetupBanner ? (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>{t("pages.dashboard.gettingStarted.title")}</CardTitle>
            <CardDescription>
              {t("pages.dashboard.gettingStarted.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="default" asChild>
              <Link to={getOrgUrl("ai-interfaces")}>
                <Plug className="mr-2 size-4" />
                {t("pages.dashboard.gettingStarted.configureInterfaces")}
              </Link>
            </Button>
            <Button variant="ghost" onClick={dismissAiSetupBanner}>
              {t("pages.dashboard.gettingStarted.dismiss")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card data-tour="workflows-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xl">
              {t("pages.dashboard.workflows.title")}
            </CardTitle>
            <Workflow className="size-8 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{dashboardStats.workflows}</div>
            <p className="text-xs text-muted-foreground pt-1">
              {t("pages.dashboard.workflows.countLabel")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs h-8"
              asChild
            >
              <Link to={getOrgUrl("workflows")}>
                {t("pages.dashboard.workflows.viewAll")}
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card data-tour="executions-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xl">
              {t("pages.dashboard.executions.title")}
            </CardTitle>
            <Logs className="size-8 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {dashboardStats.executions.total}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              {t("pages.dashboard.executions.countLabel")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs h-8"
              asChild
            >
              <Link to={getOrgUrl("executions")}>
                {t("pages.dashboard.executions.viewAll")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Credits Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                {t("pages.dashboard.usage.title")}
                <Badge variant={isPro ? "default" : "secondary"}>
                  {isPro
                    ? t("pages.dashboard.usage.earlyAdopter")
                    : t("pages.dashboard.usage.trial")}
                </Badge>
              </CardTitle>
              <CardDescription>
                {isPro
                  ? t("pages.dashboard.usage.proDescription")
                  : t("pages.dashboard.usage.trialDescription")}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={getOrgUrl("billing")}>
                {t("pages.dashboard.usage.manageBilling")}
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Included Usage Gauge */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {isPro
                  ? t("pages.dashboard.usage.includedUsage")
                  : t("pages.dashboard.usage.availableUsage")}
              </span>
              <span>
                {Math.min(usageThisPeriod, includedCredits).toLocaleString()} /{" "}
                {includedCredits.toLocaleString()}
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all rounded-full"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {usagePercent < 100
                ? t("pages.dashboard.usage.remaining", {
                    count: (
                      includedCredits - usageThisPeriod
                    ).toLocaleString(),
                  })
                : isPro
                  ? t("pages.dashboard.usage.includedExhausted")
                  : t("pages.dashboard.usage.exhausted")}
            </p>
          </div>

          {/* Overage Section - Pro only */}
          {isPro && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {t("pages.dashboard.usage.additionalUsage")}
                </span>
                <span>
                  {currentOverage.toLocaleString()}
                  {hasOverageLimit &&
                    ` / ${billing!.overageLimit!.toLocaleString()}`}
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                {currentOverage > 0 && (
                  <div
                    className={`h-full transition-all rounded-full ${isOverageAtLimit ? "bg-red-500" : "bg-orange-500"}`}
                    style={{
                      width: hasOverageLimit
                        ? `${Math.min(100, (currentOverage / billing!.overageLimit!) * 100)}%`
                        : `${Math.min(100, (currentOverage / includedCredits) * 100)}%`,
                    }}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {currentOverage > 0
                  ? isOverageAtLimit
                    ? t("pages.dashboard.usage.limitReached")
                    : t("pages.dashboard.usage.billedEndOfPeriod")
                  : hasOverageLimit
                    ? t("pages.dashboard.usage.limitCredits", {
                        count: billing!.overageLimit!.toLocaleString(),
                      })
                    : t("pages.dashboard.usage.noOverageYet")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <CreateWorkflowDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateWorkflow={handleCreateWorkflow}
      />
    </InsetLayout>
  );
}
