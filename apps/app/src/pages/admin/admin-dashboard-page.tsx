import Activity from "lucide-react/icons/activity";
import Building2 from "lucide-react/icons/building-2";
import TrendingUp from "lucide-react/icons/trending-up";
import UserCheck from "lucide-react/icons/user-check";
import Users from "lucide-react/icons/users";
import Workflow from "lucide-react/icons/workflow";
import { useEffect } from "react";

import { AdminTrendsCharts } from "@/components/admin/admin-trends-charts";
import { GlobalOnboardingFunnel } from "@/components/admin/global-onboarding-funnel";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminStats } from "@/services/admin-service";

export function AdminDashboardPage() {
  const { stats, statsError, isStatsLoading } = useAdminStats(30);
  const setBreadcrumbs = useBreadcrumbsSetter();
  const { t } = useTranslation();

  useEffect(() => {
    setBreadcrumbs([{ label: t("admin.dashboard.title") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  if (isStatsLoading) {
    return <InsetLoading title={t("admin.dashboard.title")} />;
  }

  if (statsError) {
    return (
      <InsetError
        title={t("admin.dashboard.title")}
        errorMessage={statsError.message}
      />
    );
  }

  const timeseries = stats?.timeseries ?? null;
  const executions30d =
    timeseries?.series.executions.reduce(
      (sum, point) => sum + point.count,
      0
    ) ?? 0;

  return (
    <InsetLayout title={t("admin.dashboard.title")}>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.dashboard.totalUsers")}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {t("admin.dashboard.totalUsersDesc")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.dashboard.totalOrganizations")}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalOrganizations ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("admin.dashboard.totalOrganizationsDesc")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.dashboard.totalWorkflows")}
            </CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalWorkflows ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("admin.dashboard.totalWorkflowsDesc")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.dashboard.recentSignups")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.recentSignups ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("admin.dashboard.recentSignupsDesc")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.dashboard.activeUsers")}
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeUsers24h ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("admin.dashboard.activeUsersDesc")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.dashboard.executions")}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{executions30d}</div>
            <p className="text-xs text-muted-foreground">
              {t("admin.dashboard.executionsDesc")}
            </p>
          </CardContent>
        </Card>
      </div>

      {stats?.funnel && (
        <div className="mb-6">
          <GlobalOnboardingFunnel funnel={stats.funnel} />
        </div>
      )}

      <AdminTrendsCharts timeseries={timeseries} isLoading={false} />
    </InsetLayout>
  );
}
