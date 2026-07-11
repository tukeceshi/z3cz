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
import { type AdminEmail, useAdminEmails } from "@/services/admin-service";

export function AdminEmailsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const { query: search, formProps } = useAdminSearch(() => setPage(1));
  const limit = 20;
  const setBreadcrumbs = useBreadcrumbsSetter();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.emails") }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const organizationId = searchParams.get("organizationId") || undefined;

  const { emails, pagination, emailsError, isEmailsLoading } = useAdminEmails(
    page,
    limit,
    search || undefined,
    organizationId
  );

  const columns = useMemo(
    () => createOrgScopedColumns<AdminEmail>(navigate, t),
    [navigate, t]
  );

  if (isEmailsLoading) {
    return <InsetLoading title={t("admin.emails.title")} />;
  }

  if (emailsError) {
    return (
      <InsetError
        title={t("admin.emails.title")}
        errorMessage={emailsError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("admin.emails.title")}>
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
        data={emails}
        emptyState={{
          title: t("admin.emails.emptyTitle"),
          description: search
            ? t("admin.emails.emptySearch")
            : t("admin.emails.emptyDefault"),
        }}
      />

      <AdminPagination
        page={page}
        limit={limit}
        itemCount={emails.length}
        total={pagination?.total}
        totalPages={pagination?.totalPages}
        itemLabel={t("admin.pagination.emails")}
        onPageChange={setPage}
      />
    </InsetLayout>
  );
}
