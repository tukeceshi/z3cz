import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminTableToolbar } from "@/components/admin/admin-table-toolbar";
import { OnboardingDots } from "@/components/admin/onboarding-dots";
import { RowActionsMenu } from "@/components/admin/row-actions-menu";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAdminSearch } from "@/hooks/use-admin-search";
import type { TranslateFn } from "@/i18n";
import { type AdminUser, useAdminUsers } from "@/services/admin-service";
import { formatDate } from "@/utils/date";

function createColumns(
  navigate: ReturnType<typeof useNavigate>,
  t: TranslateFn
): ColumnDef<AdminUser>[] {
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
          <Link
            to={`/admin/support?compose=1&to=${encodeURIComponent(row.original.email)}`}
            className="text-muted-foreground hover:underline"
          >
            {row.original.email}
          </Link>
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
      accessorKey: "role",
      header: t("admin.common.role"),
      cell: ({ row }) => (
        <Badge
          variant={row.original.role === "admin" ? "destructive" : "outline"}
        >
          {row.original.role}
        </Badge>
      ),
    },
    {
      id: "onboarding",
      header: t("admin.common.onboarding"),
      cell: ({ row }) => <OnboardingDots user={row.original} />,
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
            onClick={() => navigate(`/admin/users/${row.original.id}`)}
          >
            {t("admin.common.view")}
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];
}

export function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const { query: search, formProps } = useAdminSearch(() => setPage(1));
  const limit = 20;
  const setBreadcrumbs = useBreadcrumbsSetter();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.users") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const { users, pagination, usersError, isUsersLoading } = useAdminUsers(
    page,
    limit,
    search || undefined
  );

  const columns = useMemo(
    () => createColumns(navigate, t),
    [navigate, t]
  );

  if (isUsersLoading) {
    return <InsetLoading title={t("admin.users.title")} />;
  }

  if (usersError) {
    return (
      <InsetError
        title={t("admin.users.title")}
        errorMessage={usersError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("admin.users.title")}>
      <AdminTableToolbar search={formProps} />

      <DataTable
        columns={columns}
        data={users}
        emptyState={{
          title: t("admin.users.emptyTitle"),
          description: search
            ? t("admin.users.emptySearch")
            : t("admin.users.emptyDefault"),
        }}
      />

      <AdminPagination
        page={page}
        limit={limit}
        itemCount={users.length}
        total={pagination?.total}
        totalPages={pagination?.totalPages}
        itemLabel={t("admin.pagination.users")}
        onPageChange={setPage}
      />
    </InsetLayout>
  );
}
