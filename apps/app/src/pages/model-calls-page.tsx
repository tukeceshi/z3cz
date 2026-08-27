import { format } from "date-fns";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { ModelInvocationsDateFilterToolbar } from "@/components/model-invocations-date-filter-toolbar";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-context";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { useOrgUrl } from "@/hooks/use-org-url";
import {
  fetchModelCallDetail,
  useModelCalls,
} from "@/services/platform-ai-model-service";
import { formatModelCallSummary } from "@/utils/format-model-call-detail";
import {
  hasAppliedDateFilter,
  MODEL_INVOCATIONS_PAGE_SIZE,
  toAppliedDateParams,
} from "@/utils/model-invocations-date-filter";
import {
  invocationStatusBadgeVariant,
  invocationStatusLabelKey,
} from "@/utils/model-invocation-status";

export function ModelCallsPage() {
  const { t } = useTranslation();
  const perms = useOrgPermissions();

  if (!perms.canAccessModelCalls) {
    return (
      <OrgPermissionGate allowed={false} title={t("sidebar.modelCalls")}>
        {null}
      </OrgPermissionGate>
    );
  }

  return <ModelCallsPageContent />;
}

function ModelCallsPageContent() {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const { getOrgUrl } = useOrgUrl();
  const orgId = organization?.id;
  const setBreadcrumbs = useBreadcrumbsSetter();
  const [page, setPage] = useState(1);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined);
  const [appliedRange, setAppliedRange] = useState<DateRange | undefined>(
    undefined
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailContent, setDetailContent] = useState<string>("");
  const [detailTitle, setDetailTitle] = useState<string>("");

  const appliedDates = toAppliedDateParams(appliedRange);
  const { invocations, total, isLoading } = useModelCalls(orgId, {
    limit: MODEL_INVOCATIONS_PAGE_SIZE,
    offset: (page - 1) * MODEL_INVOCATIONS_PAGE_SIZE,
    dateFrom: appliedDates.dateFrom,
    dateTo: appliedDates.dateTo,
    tzOffset: hasAppliedDateFilter(appliedDates)
      ? new Date().getTimezoneOffset()
      : undefined,
  });

  const totalPages = Math.max(
    1,
    Math.ceil(total / MODEL_INVOCATIONS_PAGE_SIZE)
  );

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.workflows"), to: getOrgUrl("/workflows") },
      { label: t("pages.modelCalls.title") },
    ]);
    return () => setBreadcrumbs([]);
  }, [getOrgUrl, setBreadcrumbs, t]);

  const handleSearch = () => {
    setAppliedRange(draftRange);
    setPage(1);
  };

  const handleClear = () => {
    setDraftRange(undefined);
    setAppliedRange(undefined);
    setPage(1);
  };

  const handleOpenDetail = async (id: string) => {
    if (!orgId) return;
    setSelectedId(id);
    const invocation = await fetchModelCallDetail(orgId, id);
    setDetailTitle(invocation.displayName);
    setDetailContent(formatModelCallSummary(invocation));
  };

  return (
    <InsetLayout title={t("pages.modelCalls.title")}>
      <ModelInvocationsDateFilterToolbar
        draftRange={draftRange}
        onDraftRangeChange={setDraftRange}
        onSearch={handleSearch}
        onClear={handleClear}
        allDatesLabel={t("pages.modelCalls.allDates")}
        searchLabel={t("pages.modelCalls.search")}
        clearFilterLabel={t("pages.modelCalls.clearFilter")}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : invocations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("pages.modelCalls.empty")}</p>
      ) : (
        <>
          <div className="space-y-2">
            {invocations.map((invocation) => (
              <div
                key={invocation.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {invocation.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {invocation.source === "workflow-agent"
                      ? `${t("pages.modelCalls.sourceAgent")} · `
                      : ""}
                    {format(new Date(invocation.createdAt), "yyyy-MM-dd HH:mm")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={invocationStatusBadgeVariant(invocation.status)}>
                    {t(invocationStatusLabelKey(invocation.status))}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDetail(invocation.id)}
                  >
                    {t("pages.modelCalls.view")}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <AdminPagination
            page={page}
            limit={MODEL_INVOCATIONS_PAGE_SIZE}
            itemCount={invocations.length}
            total={total}
            totalPages={totalPages}
            itemLabel={t("pages.modelCalls.paginationLabel")}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog open={selectedId !== null} onOpenChange={() => setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap text-xs">
            {detailContent}
          </pre>
        </DialogContent>
      </Dialog>
    </InsetLayout>
  );
}
