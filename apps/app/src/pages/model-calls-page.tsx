import { format } from "date-fns";
import CalendarIcon from "lucide-react/icons/calendar";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/components/auth-context";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { useOrgUrl } from "@/hooks/use-org-url";
import {
  fetchModelCallDetail,
  useModelCalls,
} from "@/services/platform-ai-model-service";
import { formatModelCallSummary } from "@/utils/format-model-call-detail";
import {
  invocationStatusBadgeVariant,
  invocationStatusLabelKey,
} from "@/utils/model-invocation-status";
import { cn } from "@/utils/utils";

const PAGE_SIZE = 20;

function formatDateRangeLabel(
  range: DateRange | undefined,
  allDatesLabel: string
): string {
  if (!range?.from) {
    return allDatesLabel;
  }

  const fromLabel = format(range.from, "yyyy-MM-dd");
  if (!range.to) {
    return fromLabel;
  }

  const toLabel = format(range.to, "yyyy-MM-dd");
  if (toLabel === fromLabel) {
    return fromLabel;
  }

  return `${fromLabel} ~ ${toLabel}`;
}

function toAppliedDateParams(range: DateRange | undefined): {
  dateFrom?: string;
  dateTo?: string;
} {
  if (!range?.from) {
    return {};
  }

  const dateFrom = format(range.from, "yyyy-MM-dd");
  const endDate = range.to ?? range.from;
  const dateTo = format(endDate, "yyyy-MM-dd");
  return { dateFrom, dateTo };
}

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
  const hasDateFilter =
    appliedDates.dateFrom !== undefined || appliedDates.dateTo !== undefined;

  const { invocations, total, isLoading } = useModelCalls(orgId, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    dateFrom: appliedDates.dateFrom,
    dateTo: appliedDates.dateTo,
    tzOffset: hasDateFilter ? new Date().getTimezoneOffset() : undefined,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "min-w-40 justify-start text-left font-normal",
                !draftRange?.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
              {formatDateRangeLabel(draftRange, t("pages.modelCalls.allDates"))}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={draftRange}
              onSelect={setDraftRange}
            />
          </PopoverContent>
        </Popover>

        <Button size="sm" onClick={handleSearch}>
          {t("pages.modelCalls.search")}
        </Button>
        <Button size="sm" variant="outline" onClick={handleClear}>
          {t("pages.modelCalls.clearFilter")}
        </Button>
      </div>

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
            limit={PAGE_SIZE}
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
