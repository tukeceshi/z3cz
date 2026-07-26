import Sparkles from "lucide-react/icons/sparkles";
import Plug from "lucide-react/icons/plug";
import Workflow from "lucide-react/icons/workflow";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/components/auth-context";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import { useDashboard } from "@/services/dashboard-service";
import { useOrganizationAiInterfaces } from "@/services/organization-ai-interface-service";
import { useModelCalls } from "@/services/platform-ai-model-service";
import { schedulePrefetchWorkflowEditorChunks } from "@/utils/workflow-editor-prefetch";

const AI_SETUP_DISMISS_KEY = "dafthunk:dashboard-ai-setup-dismissed";

export function DashboardPage() {
  const { t } = useTranslation();
  const perms = useOrgPermissions();

  if (!perms.canViewWorkflows && !perms.canAccessModelCalls) {
    return (
      <OrgPermissionGate allowed={false} title={t("sidebar.dashboard")}>
        {null}
      </OrgPermissionGate>
    );
  }

  return <DashboardPageContent />;
}

function DashboardPageContent() {
  const { t } = useTranslation();
  const perms = useOrgPermissions();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { dashboardStats, dashboardStatsError, isDashboardStatsLoading } =
    useDashboard();
  const { getOrgUrl } = useOrgUrl();
  const { organization } = useAuth();
  const orgId = organization?.id || "";
  const { interfaces, isInterfacesLoading } = useOrganizationAiInterfaces(
    orgId || undefined
  );
  const { total: modelCallsTotal, isLoading: isModelCallsLoading } =
    useModelCalls(orgId || undefined, { limit: 1 });
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

  useEffect(() => {
    schedulePrefetchWorkflowEditorChunks();
  }, []);

  if (
    isDashboardStatsLoading ||
    isInterfacesLoading ||
    (perms.canAccessModelCalls && isModelCallsLoading)
  ) {
    return <InsetLoading title={t("pages.dashboard.title")} />;
  } else if (dashboardStatsError) {
    return (
      <InsetError
        title={t("pages.dashboard.title")}
        errorMessage={
          dashboardStatsError?.message || t("common.errorOccurred")
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

  const showAiSetupBanner =
    perms.canAccessAiInterfaces && interfaces.length === 0 && !setupDismissed;

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
        {perms.canAccessModelCalls ? (
          <Card data-tour="model-calls-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xl">
                {t("pages.dashboard.modelCalls.title")}
              </CardTitle>
              <Sparkles className="size-8 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{modelCallsTotal}</div>
              <p className="text-xs text-muted-foreground pt-1">
                {t("pages.dashboard.modelCalls.countLabel")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-xs h-8"
                asChild
              >
                <Link to={getOrgUrl("model-calls")}>
                  {t("pages.dashboard.modelCalls.viewAll")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </InsetLayout>
  );
}
