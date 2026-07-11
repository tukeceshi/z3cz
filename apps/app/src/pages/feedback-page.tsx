import type { ExecutionFeedback } from "@dafthunk/types";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import CalendarIcon from "lucide-react/icons/calendar";
import DownloadIcon from "lucide-react/icons/download";
import ThumbsDown from "lucide-react/icons/thumbs-down";
import ThumbsUp from "lucide-react/icons/thumbs-up";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "@/components/auth-context";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DataTable } from "@/components/ui/data-table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppToast } from "@/hooks/use-app-toast";
import type { TranslateFn } from "@/i18n";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  exportFeedbackCsv,
  useAllCriteria,
  usePaginatedFeedback,
} from "@/services/feedback-service";
import { useWorkflows } from "@/services/workflow-service";
import { formatDate } from "@/utils/date";
import { cn } from "@/utils/utils";

export const createColumns = (
  getOrgUrl: (path: string) => string,
  t: TranslateFn
): ColumnDef<ExecutionFeedback>[] => [
  {
    accessorKey: "workflowName",
    header: t("pages.feedback.columns.workflow"),
    cell: ({ row }) => {
      const workflowId = row.original.workflowId;
      const workflowName = row.getValue("workflowName") as string | undefined;
      if (!workflowId) return <span className="text-muted-foreground">-</span>;
      return (
        <Link
          to={getOrgUrl(`workflows/${workflowId}`)}
          className="hover:underline"
        >
          {workflowName || workflowId.slice(0, 8) + "..."}
        </Link>
      );
    },
  },
  {
    accessorKey: "criterionQuestion",
    header: t("pages.feedback.columns.criterion"),
    cell: ({ row }) => {
      const question = row.getValue("criterionQuestion") as string | undefined;
      if (!question) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="max-w-xs truncate" title={question}>
          {question}
        </div>
      );
    },
  },
  {
    accessorKey: "executionId",
    header: t("pages.feedback.columns.execution"),
    cell: ({ row }) => {
      const executionId = row.getValue("executionId") as string;
      return (
        <Link
          to={getOrgUrl(`executions/${executionId}`)}
          className="hover:underline font-mono text-xs"
        >
          {executionId}
        </Link>
      );
    },
  },
  {
    accessorKey: "sentiment",
    header: t("pages.feedback.columns.rating"),
    cell: ({ row }) => {
      const sentiment = row.getValue("sentiment") as "positive" | "negative";
      return sentiment === "positive" ? (
        <ThumbsUp className="h-4 w-4 text-green-600" />
      ) : (
        <ThumbsDown className="h-4 w-4 text-red-600" />
      );
    },
  },
  {
    accessorKey: "comment",
    header: t("pages.feedback.columns.comment"),
    cell: ({ row }) => {
      const comment = row.getValue("comment") as string | undefined;
      if (!comment) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="max-w-md truncate" title={comment}>
          {comment}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: t("pages.feedback.columns.created"),
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date | string;
      try {
        const formatted = formatDate(date);
        return <div className="font-medium">{formatted}</div>;
      } catch {
        return <div className="font-medium">-</div>;
      }
    },
  },
];

export function FeedbackPage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { getOrgUrl } = useOrgUrl();
  const { organization } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const workflowId = searchParams.get("workflowId") ?? undefined;
  const setWorkflowId = (id: string | undefined) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("workflowId", id);
      else next.delete("workflowId");
      return next;
    });
  };
  const [criterionId, setCriterionId] = useState<string | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const filters = useMemo(
    () => ({
      workflowId,
      criterionId,
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
      endDate: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
    }),
    [workflowId, criterionId, startDate, endDate]
  );

  const {
    feedbackList,
    feedbackError,
    isFeedbackInitialLoading,
    isFeedbackReachingEnd,
    feedbackObserverTargetRef,
  } = usePaginatedFeedback(filters);

  const { workflows } = useWorkflows();
  const { criteria } = useAllCriteria();

  const filteredCriteria = workflowId
    ? criteria.filter((c) => c.workflowId === workflowId)
    : criteria;

  const columns = useMemo(
    () => createColumns(getOrgUrl, t),
    [getOrgUrl, t]
  );

  const errorMessage = feedbackError
    ? feedbackError instanceof Error
      ? feedbackError.message
      : t("common.unknownError")
    : "";

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.feedback") }]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    if (feedbackError) {
      appToast.errorRaw(t("pages.feedback.fetchFailed", { message: errorMessage }));
    }
  }, [feedbackError, errorMessage, appToast, t]);

  useEffect(() => {
    setCriterionId(undefined);
  }, [workflowId]);

  const handleExport = useCallback(async () => {
    if (!organization?.id) return;
    setIsExporting(true);
    try {
      await exportFeedbackCsv(organization.id, filters);
    } catch {
      appToast.error("pages.feedback.exportFailed");
    } finally {
      setIsExporting(false);
    }
  }, [organization?.id, filters, appToast]);

  if (isFeedbackInitialLoading) {
    return <InsetLoading title={t("pages.feedback.title")} />;
  } else if (feedbackError) {
    return (
      <InsetError title={t("pages.feedback.title")} errorMessage={errorMessage} />
    );
  }

  return (
    <TooltipProvider>
      <InsetLayout title={t("pages.feedback.title")}>
        <div className="mb-6 min-h-10">
          <div className="text-sm text-muted-foreground max-w-2xl">
            {t("pages.feedback.description")}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <Select
            value={workflowId ?? "all"}
            onValueChange={(v) => setWorkflowId(v === "all" ? undefined : v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("pages.executions.allWorkflows")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("pages.executions.allWorkflows")}</SelectItem>
              {workflows.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={criterionId ?? "all"}
            onValueChange={(v) => setCriterionId(v === "all" ? undefined : v)}
            disabled={!workflowId}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("pages.feedback.allCriteria")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("pages.feedback.allCriteria")}</SelectItem>
              {filteredCriteria.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.question}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-36 justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {startDate ? formatDate(startDate) : t("pages.feedback.startDate")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                disabled={(date) => (endDate ? date > endDate : false)}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-36 justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {endDate ? formatDate(endDate) : t("pages.feedback.endDate")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                disabled={(date) => (startDate ? date < startDate : false)}
              />
            </PopoverContent>
          </Popover>

          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || feedbackList.length === 0}
            >
              <DownloadIcon className="h-4 w-4 mr-2" />
              {isExporting ? t("pages.feedback.exporting") : t("pages.feedback.exportCsv")}
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={feedbackList}
          emptyState={{
            title: feedbackError
              ? t("pages.feedback.empty.error")
              : feedbackList.length === 0
                ? t("pages.feedback.empty.none")
                : t("common.noResults"),
            description: feedbackError
              ? errorMessage
              : feedbackList.length === 0
                ? t("pages.feedback.empty.noneDescription")
                : t("pages.feedback.empty.noMatchDescription"),
          }}
        />
        {!isFeedbackReachingEnd && !isFeedbackInitialLoading && (
          <div ref={feedbackObserverTargetRef} style={{ height: "1px" }} />
        )}
      </InsetLayout>
    </TooltipProvider>
  );
}
