import type { ExecutionStatusType } from "@dafthunk/types";
import {
  type ListExecutionsResponse,
  WorkflowExecution,
} from "@dafthunk/types";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import CalendarIcon from "lucide-react/icons/calendar";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ExecutionStatusBadge } from "@/components/executions/execution-status-badge";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useTranslation } from "@/components/locale-provider";
import type { TranslateFn } from "@/i18n";
import { useAppToast } from "@/hooks/use-app-toast";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  type ExecutionFilters,
  usePaginatedExecutions,
} from "@/services/execution-service";
import { useWorkflows } from "@/services/workflow-service";
import { formatDate } from "@/utils/date";
import { cn } from "@/utils/utils";

const EXECUTION_STATUS_LABELS = {
  started: "pages.executions.status.started",
  executing: "pages.executions.status.executing",
  completed: "pages.executions.status.completed",
  error: "pages.executions.status.error",
  cancelled: "pages.executions.status.cancelled",
} as const;

export const createColumns = (
  getOrgUrl: (path: string) => string,
  t: TranslateFn
): ColumnDef<ListExecutionsResponse["executions"][0]>[] => [
  {
    accessorKey: "workflowName",
    header: t("pages.executions.columns.workflow"),
    cell: ({ row }) => {
      const workflowName = row.getValue("workflowName") as string;
      const execution = row.original as WorkflowExecution;
      return (
        <Link
          to={getOrgUrl(`executions/${execution.id}`)}
          className="hover:underline"
        >
          {workflowName}
        </Link>
      );
    },
  },
  {
    accessorKey: "status",
    header: t("pages.executions.columns.status"),
    cell: ({ row }) => {
      const status = row.getValue("status") as WorkflowExecution["status"];
      return <ExecutionStatusBadge status={status} />;
    },
  },
  {
    accessorKey: "startedAt",
    header: t("pages.executions.columns.started"),
    cell: ({ row }) => {
      const date = row.getValue("startedAt") as Date | string | undefined;
      if (!date) return <div className="font-medium">-</div>;
      try {
        const formatted = formatDate(date);
        return <div className="font-medium">{formatted}</div>;
      } catch {
        return <div className="font-medium">-</div>;
      }
    },
  },
  {
    accessorKey: "endedAt",
    header: t("pages.executions.columns.ended"),
    cell: ({ row }) => {
      const date = row.getValue("endedAt") as Date | string | undefined | null;
      if (!date) return <div className="font-medium">-</div>;
      try {
        const formatted = formatDate(date);
        return <div className="font-medium">{formatted}</div>;
      } catch {
        return <div className="font-medium">-</div>;
      }
    },
  },
  {
    accessorKey: "duration",
    header: t("pages.executions.columns.duration"),
    cell: ({ row }) => {
      const execution = row.original as WorkflowExecution;
      const { startedAt, endedAt } = execution;

      if (startedAt && endedAt) {
        const durationMs =
          new Date(endedAt).getTime() - new Date(startedAt).getTime();
        const seconds = Math.floor((durationMs / 1000) % 60);
        const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
        // const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24); // Uncomment if hours are needed

        let formattedDuration = "";
        // if (hours > 0) {
        //   formattedDuration += `${hours}h `;
        // }
        if (minutes > 0) {
          formattedDuration += `${minutes}m `;
        }
        formattedDuration += `${seconds}s`;

        return <div>{formattedDuration.trim()}</div>;
      }
      return <div>-</div>;
    },
  },
  {
    accessorKey: "usage",
    header: t("pages.executions.columns.usage"),
    cell: ({ row }) => {
      const usage = row.getValue("usage") as number | undefined;
      return <span>{(usage ?? 0).toLocaleString()}</span>;
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const execution = row.original;
      return (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t("common.openMenu")}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={getOrgUrl(`executions/${execution.id}`)}>
                  {t("common.view")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export function ExecutionsPage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { getOrgUrl } = useOrgUrl();
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
  const [status, setStatus] = useState<ExecutionStatusType | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const { workflows } = useWorkflows();

  const filters = useMemo<ExecutionFilters>(
    () => ({
      workflowId,
      status,
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
      endDate: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
    }),
    [workflowId, status, startDate, endDate]
  );

  const {
    paginatedExecutions,
    executionsError,
    isExecutionsInitialLoading,
    isExecutionsReachingEnd,
    executionsObserverTargetRef,
  } = usePaginatedExecutions(filters);

  const columns = useMemo(
    () => createColumns(getOrgUrl, t),
    [getOrgUrl, t]
  );

  const errorMessage = executionsError
    ? executionsError instanceof Error
      ? executionsError.message
      : t("common.unknownError")
    : "";

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.executions") }]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    if (executionsError) {
      appToast.errorRaw(t("pages.executions.fetchFailed", { message: errorMessage }));
    }
  }, [executionsError, errorMessage, appToast, t]);

  if (isExecutionsInitialLoading) {
    return <InsetLoading title={t("pages.executions.title")} />;
  } else if (executionsError) {
    return (
      <InsetError title={t("pages.executions.title")} errorMessage={errorMessage} />
    );
  }

  return (
    <TooltipProvider>
      <InsetLayout title={t("pages.executions.title")}>
        <div className="mb-6 min-h-10">
          <div className="text-sm text-muted-foreground max-w-2xl">
            {t("pages.executions.description")}
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
            value={status ?? "all"}
            onValueChange={(v) =>
              setStatus(v === "all" ? undefined : (v as ExecutionStatusType))
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("pages.executions.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("pages.executions.allStatuses")}</SelectItem>
              {(Object.keys(EXECUTION_STATUS_LABELS) as ExecutionStatusType[]).map(
                (value) => (
                <SelectItem key={value} value={value}>
                  {t(EXECUTION_STATUS_LABELS[value])}
                </SelectItem>
              )
              )}
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
                {startDate ? formatDate(startDate) : t("pages.executions.startDate")}
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
                {endDate ? formatDate(endDate) : t("pages.executions.endDate")}
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
        </div>

        <DataTable
          columns={columns}
          data={paginatedExecutions}
          emptyState={{
            title: executionsError
              ? t("pages.executions.empty.error")
              : paginatedExecutions.length === 0
                ? t("pages.executions.empty.none")
                : t("common.noResults"),
            description: executionsError
              ? errorMessage
              : paginatedExecutions.length === 0
                ? t("pages.executions.empty.noneDescription")
                : t("pages.executions.empty.noMatchDescription"),
          }}
        />
        {!isExecutionsReachingEnd && !isExecutionsInitialLoading && (
          <div ref={executionsObserverTargetRef} style={{ height: "1px" }} />
        )}
      </InsetLayout>
    </TooltipProvider>
  );
}
