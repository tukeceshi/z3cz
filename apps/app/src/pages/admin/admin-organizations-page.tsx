import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminTableToolbar } from "@/components/admin/admin-table-toolbar";
import { RowActionsMenu } from "@/components/admin/row-actions-menu";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAdminSearch } from "@/hooks/use-admin-search";
import type { TranslateFn } from "@/i18n";
import {
  type AdminOrganization,
  useAdminOrganizations,
} from "@/services/admin-service";
import { formatDate } from "@/utils/date";

function createColumns(
  navigate: ReturnType<typeof useNavigate>,
  t: TranslateFn
): ColumnDef<AdminOrganization>[] {
  return [
    {
      accessorKey: "name",
      header: t("admin.common.name"),
      cell: ({ row }) => (
        <Link
          to={`/admin/organizations/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "memberCount",
      header: t("admin.common.members"),
    },
    {
      accessorKey: "workflowCount",
      header: t("admin.common.workflows"),
    },
    {
      accessorKey: "subscriptionStatus",
      header: t("admin.common.status"),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.subscriptionStatus ? (
            <Badge
              variant={
                row.original.subscriptionStatus === "active"
                  ? "default"
                  : "secondary"
              }
            >
              {row.original.subscriptionStatus}
            </Badge>
          ) : (
            <Badge variant="outline">{t("admin.common.trial")}</Badge>
          )}
          {row.original.creditsExhausted && (
            <Badge variant="destructive">
              {t("admin.common.creditsExhausted")}
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("admin.common.created"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem
            onClick={() => navigate(`/admin/organizations/${row.original.id}`)}
          >
            {t("admin.common.view")}
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];
}

export function AdminOrganizationsPage() {
  const [page, setPage] = useState(1);
  const { query: search, formProps } = useAdminSearch(() => setPage(1));
  const limit = 20;
  const setBreadcrumbs = useBreadcrumbsSetter();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.organizations") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const {
    organizations,
    pagination,
    organizationsError,
    isOrganizationsLoading,
  } = useAdminOrganizations(page, limit, search || undefined);

  const columns = useMemo(
    () => createColumns(navigate, t),
    [navigate, t]
  );

  if (isOrganizationsLoading) {
    return <InsetLoading title={t("admin.organizations.title")} />;
  }

  if (organizationsError) {
    return (
      <InsetError
        title={t("admin.organizations.title")}
        errorMessage={organizationsError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("admin.organizations.title")}>
      <AdminTableToolbar search={formProps} />

      <DataTable
        columns={columns}
        data={organizations}
        emptyState={{
          title: t("admin.organizations.emptyTitle"),
          description: search
            ? t("admin.organizations.emptySearch")
            : t("admin.organizations.emptyDefault"),
        }}
      />

      <AdminPagination
        page={page}
        limit={limit}
        itemCount={organizations.length}
        total={pagination?.total}
        totalPages={pagination?.totalPages}
        itemLabel={t("admin.pagination.organizations")}
        onPageChange={setPage}
      />
    </InsetLayout>
  );
}
