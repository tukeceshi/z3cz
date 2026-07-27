import { format } from "date-fns";
import { useEffect, useState } from "react";

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
import {
  fetchAdminModelCallDetail,
  useAdminModelInvocations,
} from "@/services/admin-ai-model-service";
import {
  invocationStatusBadgeVariant,
  invocationStatusLabelKey,
} from "@/utils/model-invocation-status";

export function AdminModelInvocationsPage() {
  const { t } = useTranslation();
  const setBreadcrumbs = useBreadcrumbsSetter();
  const { invocations, isLoading } = useAdminModelInvocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailContent, setDetailContent] = useState<string>("");
  const [detailTitle, setDetailTitle] = useState<string>("");

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.admin"), to: "/admin" },
      { label: t("pages.adminModelInvocations.title") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  const handleOpenDetail = async (id: string) => {
    setSelectedId(id);
    const invocation = await fetchAdminModelCallDetail(id);
    setDetailTitle(invocation.displayName);
    setDetailContent(invocation.content || invocation.error || "");
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

      <Dialog open={selectedId !== null} onOpenChange={() => setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-xs">
            {detailContent}
          </pre>
        </DialogContent>
      </Dialog>
    </InsetLayout>
  );
}
