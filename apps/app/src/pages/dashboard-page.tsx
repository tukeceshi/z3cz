import { useEffect } from "react";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { DashboardRecentWorkflows } from "@/components/dashboard-recent-workflows";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import { useDashboard } from "@/services/dashboard-service";
import { scheduleConsolePrefetch } from "@/utils/console-prefetch";

export function DashboardPage() {
  const { t } = useTranslation();
  const perms = useOrgPermissions();

  if (!perms.canViewWorkflows) {
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
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { dashboardStats, dashboardStatsError, isDashboardStatsLoading } =
    useDashboard();

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.dashboard") }]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    scheduleConsolePrefetch();
  }, []);

  if (isDashboardStatsLoading) {
    return <InsetLoading title={t("pages.dashboard.title")} />;
  }

  if (dashboardStatsError) {
    return (
      <InsetError
        title={t("pages.dashboard.title")}
        errorMessage={
          dashboardStatsError.message || t("common.errorOccurred")
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

  return (
    <InsetLayout title={t("pages.dashboard.title")}>
      <DashboardRecentWorkflows workflows={dashboardStats.recentWorkflows} />
    </InsetLayout>
  );
}
