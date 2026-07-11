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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TranslateFn } from "@/i18n";
import {
  type AdminExecution,
  useAdminExecutions,
} from "@/services/admin-service";
import { formatDate } from "@/utils/date";

function getStatusVariant(status: string) {
  switch (status) {
    case "completed":
      return "default";
    case "running":
      return "secondary";
    case "error":
      return "destructive";
    case "cancelled":
      return "outline";
    default:
      return "outline";
  }
}

function createColumns(
  navigate: ReturnType<typeof useNavigate>,
  t: TranslateFn
): ColumnDef<AdminExecution>[] {
  return [
    {
      accessorKey: "workflowName",
      header: t("admin.common.workflow"),
      cell: ({ row }) => (
        <Link
          to={`/admin/executions/${row.original.id}?organizationId=${row.original.organizationId}`}
          className="font-medium hover:underline"
        >
          {row.original.workflowName}
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
      accessorKey: "status",
      header: t("admin.common.status"),
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "usage",
      header: t("admin.common.usage"),
    },
    {
      accessorKey: "startedAt",
      header: t("admin.common.started"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.startedAt)}
        </span>
      ),
    },
    {
      accessorKey: "endedAt",
      header: t("admin.common.ended"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.endedAt ? formatDate(row.original.endedAt) : "-"}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem
            onClick={() =>
              navigate(
                `/admin/executions/${row.original.id}?organizationId=${row.original.organizationId}`
              )
            }
          >
            {t("admin.common.viewExecution")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              navigate(`/admin/workflows/${row.original.workflowId}`)
            }
          >
            {t("admin.common.viewWorkflow")}
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

export function AdminExecutionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const limit = 20;
  const setBreadcrumbs = useBreadcrumbsSetter();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.executions") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const organizationId = searchParams.get("organizationId") || undefined;
  const workflowId = searchParams.get("workflowId") || undefined;

  const { executions, executionsError, isExecutionsLoading } =
    useAdminExecutions(
      page,
      limit,
      organizationId,
      workflowId,
      status === "all" ? undefined : status
    );

  const statusOptions = useMemo(
    () => [
      { value: "all", label: t("admin.executions.allStatuses") },
      { value: "running", label: t("admin.executions.statusRunning") },
      { value: "completed", label: t("admin.executions.statusCompleted") },
      { value: "error", label: t("admin.executions.statusError") },
      { value: "cancelled", label: t("admin.executions.statusCancelled") },
    ],
    [t]
  );

  const clearParam = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next);
    setPage(1);
  };

  const columns = useMemo(
    () => createColumns(navigate, t),
    [navigate, t]
  );

  if (isExecutionsLoading) {
    return <InsetLoading title={t("admin.executions.title")} />;
  }

  if (executionsError) {
    return (
      <InsetError
        title={t("admin.executions.title")}
        errorMessage={executionsError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("admin.executions.title")}>
      <AdminTableToolbar>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("admin.executions.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {organizationId && (
          <Button
            variant="outline"
            onClick={() => clearParam("organizationId")}
          >
            {t("admin.common.clearOrgFilter")}
          </Button>
        )}
        {workflowId && (
          <Button variant="outline" onClick={() => clearParam("workflowId")}>
            {t("admin.common.clearWorkflowFilter")}
          </Button>
        )}
      </AdminTableToolbar>

      <DataTable
        columns={columns}
        data={executions}
        emptyState={{
          title: t("admin.executions.emptyTitle"),
          description: t("admin.executions.emptyDesc"),
        }}
      />

      <AdminPagination
        page={page}
        limit={limit}
        itemCount={executions.length}
        itemLabel={t("admin.pagination.executions")}
        onPageChange={setPage}
      />
    </InsetLayout>
  );
}
