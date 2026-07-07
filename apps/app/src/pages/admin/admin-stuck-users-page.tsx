import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { RowActionsMenu } from "@/components/admin/row-actions-menu";
import { InsetError } from "@/components/inset-error";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getListStageLabel } from "@/i18n/admin-labels";
import type { TranslateFn } from "@/i18n";
import {
  type AdminStuckUser,
  LIST_STAGES,
  type ListStage,
  useAdminStuckSummary,
  useAdminStuckUsers,
} from "@/services/admin-service";
import { formatDate } from "@/utils/date";

const THRESHOLD_OPTIONS = [3, 7, 14];

function createColumns(
  navigate: ReturnType<typeof useNavigate>,
  t: TranslateFn
): ColumnDef<AdminStuckUser>[] {
  return [
    {
      accessorKey: "name",
      header: t("admin.table.user"),
      cell: ({ row }) => (
        <Link
          to={`/admin/users/${row.original.id}`}
          className="flex items-center gap-2 font-medium hover:underline"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={row.original.avatarUrl || undefined} />
            <AvatarFallback>
              {row.original.name?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <span>{row.original.name}</span>
        </Link>
      ),
    },
    {
      accessorKey: "email",
      header: t("admin.table.email"),
      cell: ({ row }) =>
        row.original.email ? (
          <span className="text-muted-foreground">{row.original.email}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: "plan",
      header: t("admin.table.plan"),
      cell: ({ row }) => (
        <Badge variant={row.original.plan === "pro" ? "default" : "secondary"}>
          {row.original.plan}
        </Badge>
      ),
    },
    {
      accessorKey: "furthestStageAt",
      header: t("admin.table.stuckSince"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.furthestStageAt)}
        </span>
      ),
    },
    {
      accessorKey: "daysSinceAdvance",
      header: t("admin.table.days"),
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.daysSinceAdvance}d</Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem
            onClick={() =>
              navigate(`/admin/users/${row.original.id}?compose=draft`)
            }
          >
            {t("admin.table.draftMessage")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigate(`/admin/users/${row.original.id}`)}
          >
            {t("admin.table.viewUser")}
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];
}

export function AdminStuckUsersPage() {
  const [minDays, setMinDays] = useState(7);
  const [stage, setStage] = useState<ListStage>("workflow_created");
  const [page, setPage] = useState(1);
  const isDormantTab = stage === "dormant";
  const limit = 20;
  const setBreadcrumbs = useBreadcrumbsSetter();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    setBreadcrumbs([{ label: t("admin.onboarding.breadcrumb") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const { stuckSummary, stuckSummaryError } = useAdminStuckSummary(minDays);
  const { stuckUsers, pagination, stuckUsersError } = useAdminStuckUsers(
    stage,
    minDays,
    page,
    limit
  );

  const columns = useMemo(
    () => createColumns(navigate, t),
    [navigate, t]
  );

  if (stuckSummaryError) {
    return (
      <InsetError
        title={t("admin.onboarding.breadcrumb")}
        errorMessage={stuckSummaryError.message}
      />
    );
  }

  const onStageChange = (next: string) => {
    setStage(next as ListStage);
    setPage(1);
  };

  const onThresholdChange = (next: string) => {
    setMinDays(Number(next));
    setPage(1);
  };

  const dormantDays = stuckSummary?.dormantDays ?? 30;

  return (
    <InsetLayout title={t("admin.onboarding.title")}>
      <p className="text-sm text-muted-foreground mb-4">
        {isDormantTab
          ? t("admin.onboarding.dormantDescription", { days: dormantDays })
          : t("admin.onboarding.activeDescription", {
              days: minDays,
              cap: dormantDays,
            })}
      </p>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <Tabs value={stage} onValueChange={onStageChange}>
          <TabsList>
            {LIST_STAGES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {getListStageLabel(t, s)}
                <span className="ml-2 text-xs text-muted-foreground">
                  {stuckSummary?.counts[s] ?? "—"}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {!isDormantTab && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">
              {t("admin.onboarding.stuckFor")}
            </span>
            <Select value={String(minDays)} onValueChange={onThresholdChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THRESHOLD_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {t("admin.onboarding.daysPlus", { days: d })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {stuckUsersError ? (
        <InsetError
          title={t("admin.onboarding.breadcrumb")}
          errorMessage={stuckUsersError.message}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={stuckUsers}
            emptyState={{
              title: isDormantTab
                ? t("admin.onboarding.emptyDormantTitle")
                : t("admin.onboarding.emptyStuckTitle"),
              description: isDormantTab
                ? t("admin.onboarding.emptyDormantDesc")
                : t("admin.onboarding.emptyStuckDesc", {
                    stage: getListStageLabel(t, stage),
                    days: minDays,
                  }),
            }}
          />

          <AdminPagination
            page={page}
            limit={limit}
            itemCount={stuckUsers.length}
            total={pagination?.total}
            totalPages={pagination?.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </InsetLayout>
  );
}
