import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminTableToolbar } from "@/components/admin/admin-table-toolbar";
import { RowActionsMenu } from "@/components/admin/row-actions-menu";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAdminSearch } from "@/hooks/use-admin-search";
import type { TranslateFn } from "@/i18n";
import {
  type AdminWorkflow,
  useAdminWorkflows,
} from "@/services/admin-service";
import { formatDate } from "@/utils/date";

function createColumns(
  navigate: ReturnType<typeof useNavigate>,
  t: TranslateFn
): ColumnDef<AdminWorkflow>[] {
  return [
    {
      accessorKey: "name",
      header: t("admin.common.name"),
      cell: ({ row }) => (
        <Link
          to={`/admin/workflows/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "organizationName",
      header: t("admin.common.organization"),
      cell: ({ row }) => (
        <Link
          to={`/admin/organizations/${row.original.organizationId}`}
          className="hover:underline"
        >
          {row.original.organizationName}
        </Link>
      ),
    },
    {
      accessorKey: "trigger",
      header: t("admin.common.trigger"),
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.trigger}</Badge>
      ),
    },
    {
      accessorKey: "runtime",
      header: t("admin.common.runtime"),
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.runtime}</Badge>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: t("admin.common.updated"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.updatedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem
            onClick={() => navigate(`/admin/workflows/${row.original.id}`)}
          >
            {t("admin.common.viewWorkflow")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              navigate(`/admin/executions?workflowId=${row.original.id}`)
            }
          >
            {t("admin.common.viewExecution")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              navigate(`/admin/organizations/${row.original.organizationId}`)
            }
          >
            {t("admin.common.viewOrganization")}
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];
}

export function AdminWorkflowsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const { query: search, formProps } = useAdminSearch(() => setPage(1));
  const limit = 20;
  const setBreadcrumbs = useBreadcrumbsSetter();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.workflows") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const organizationId = searchParams.get("organizationId") || undefined;

  const { workflows, pagination, workflowsError, isWorkflowsLoading } =
    useAdminWorkflows(page, limit, search || undefined, organizationId);

  const columns = useMemo(
    () => createColumns(navigate, t),
    [navigate, t]
  );

  if (isWorkflowsLoading) {
    return <InsetLoading title={t("admin.workflows.title")} />;
  }

  if (workflowsError) {
    return (
      <InsetError
        title={t("admin.workflows.title")}
        errorMessage={workflowsError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("admin.workflows.title")}>
      <AdminTableToolbar search={formProps}>
        {organizationId && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchParams({});
              setPage(1);
            }}
          >
            {t("admin.common.clearOrgFilter")}
          </Button>
        )}
      </AdminTableToolbar>

      <DataTable
        columns={columns}
        data={workflows}
        emptyState={{
          title: t("admin.workflows.emptyTitle"),
          description: search
            ? t("admin.workflows.emptySearch")
            : t("admin.workflows.emptyDefault"),
        }}
      />

      <AdminPagination
        page={page}
        limit={limit}
        itemCount={workflows.length}
        total={pagination?.total}
        totalPages={pagination?.totalPages}
        itemLabel={t("admin.pagination.workflows")}
        onPageChange={setPage}
      />
    </InsetLayout>
  );
}
