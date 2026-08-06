import { format } from "date-fns";
import { useEffect, useState } from "react";

import { DETAIL_PRE_CLASS, LIST_SCROLL_CLASS } from "@/components/list-scroll";
import { InsetLayout } from "@/components/layouts/inset-layout";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchAdminModelCallDetail,
  useAdminModelInvocations,
} from "@/services/admin-ai-model-service";
import type { AiModelInvocationDetailResponse } from "@dafthunk/types";
import {
  formatApiLogDetail,
  formatApiLogLine,
} from "@/utils/format-api-interface-log";
import { formatModelCallSummary } from "@/utils/format-model-call-detail";
import {
  invocationStatusBadgeVariant,
  invocationStatusLabelKey,
} from "@/utils/model-invocation-status";

export function AdminModelInvocationsPage() {
  const { t } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const { invocations, isLoading } = useAdminModelInvocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AiModelInvocationDetailResponse | null>(
    null
  );
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.admin"), to: "/admin" },
      { label: t("pages.adminModelInvocations.title") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const handleOpenDetail = async (id: string) => {
    setSelectedId(id);
    setExpandedLogId(null);
    const response = await fetchAdminModelCallDetail(id);
    setDetail(response);
  };

  const handleClose = (): void => {
    setSelectedId(null);
    setDetail(null);
    setExpandedLogId(null);
  };

  return (
    <InsetLayout title={t("pages.adminModelInvocations.title")}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : invocations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("pages.adminModelInvocations.empty")}
        </p>
      ) : (
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
                  {t("pages.adminModelInvocations.view")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <DialogContent className="max-w-3xl min-w-0">
          <DialogHeader>
            <DialogTitle>{detail?.invocation.displayName ?? ""}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <Tabs defaultValue="summary" className="min-w-0">
              <TabsList>
                <TabsTrigger value="summary">
                  {t("pages.adminModelInvocations.tabSummary")}
                </TabsTrigger>
                <TabsTrigger value="apiLogs">
                  {t("pages.adminModelInvocations.tabApiLogs")}
                  {detail.apiLogs.length > 0
                    ? ` (${detail.apiLogs.length})`
                    : ""}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="min-w-0">
                <pre className={`${DETAIL_PRE_CLASS} max-h-[60vh]`}>
                  {formatModelCallSummary(detail.invocation)}
                </pre>
              </TabsContent>
              <TabsContent value="apiLogs" className="min-w-0">
                {detail.apiLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("pages.adminModelInvocations.apiLogsEmpty")}
                  </p>
                ) : (
                  <div
                    className={`${LIST_SCROLL_CLASS} max-h-[60vh] min-w-0 space-y-2`}
                  >
                    {detail.apiLogs.map((log) => {
                      const expanded = expandedLogId === log.id;
                      return (
                        <div
                          key={log.id}
                          className="min-w-0 rounded-md border px-3 py-2"
                        >
                          <button
                            type="button"
                            className="w-full min-w-0 truncate text-left text-xs"
                            onClick={() =>
                              setExpandedLogId(expanded ? null : log.id)
                            }
                          >
                            {formatApiLogLine(log)}
                          </button>
                          {expanded ? (
                            <pre
                              className={`${DETAIL_PRE_CLASS} mt-2 max-h-80 text-muted-foreground`}
                            >
                              {formatApiLogDetail(log)}
                            </pre>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </InsetLayout>
  );
}
