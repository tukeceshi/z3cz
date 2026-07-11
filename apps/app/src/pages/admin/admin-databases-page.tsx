import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminTableToolbar } from "@/components/admin/admin-table-toolbar";
import { createOrgScopedColumns } from "@/components/admin/org-scoped-columns";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useAdminSearch } from "@/hooks/use-admin-search";
import {
  type AdminDatabase,
  useAdminDatabases,
} from "@/services/admin-service";

export function AdminDatabasesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const { query: search, formProps } = useAdminSearch(() => setPage(1));
  const limit = 20;
  const setBreadcrumbs = useBreadcrumbsSetter();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.databases") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const organizationId = searchParams.get("organizationId") || undefined;

  const { databases, pagination, databasesError, isDatabasesLoading } =
    useAdminDatabases(page, limit, search || undefined, organizationId);

  const columns = useMemo(
    () => createOrgScopedColumns<AdminDatabase>(navigate, t),
    [navigate, t]
  );

  if (isDatabasesLoading) {
    return <InsetLoading title={t("admin.databases.title")} />;
  }

  if (databasesError) {
    return (
      <InsetError
        title={t("admin.databases.title")}
        errorMessage={databasesError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("admin.databases.title")}>
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
        data={databases}
        emptyState={{
          title: t("admin.databases.emptyTitle"),
          description: search
            ? t("admin.databases.emptySearch")
            : t("admin.databases.emptyDefault"),
        }}
      />

      <AdminPagination
        page={page}
        limit={limit}
        itemCount={databases.length}
        total={pagination?.total}
        totalPages={pagination?.totalPages}
        itemLabel={t("admin.pagination.databases")}
        onPageChange={setPage}
      />
    </InsetLayout>
  );
}
