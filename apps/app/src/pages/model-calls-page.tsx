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
import { useAuth } from "@/components/auth-context";
import { useOrgUrl } from "@/hooks/use-org-url";
import {
  fetchModelCallDetail,
  useModelCalls,
} from "@/services/platform-ai-model-service";

export function ModelCallsPage() {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const { getOrgUrl } = useOrgUrl();
  const orgId = organization?.id;
  const setBreadcrumbs = useBreadcrumbsSetter();
  const { invocations, isLoading } = useModelCalls(orgId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailContent, setDetailContent] = useState<string>("");
  const [detailTitle, setDetailTitle] = useState<string>("");

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.workflows"), to: getOrgUrl("/workflows") },
      { label: t("pages.modelCalls.title") },
    ]);
    return () => setBreadcrumbs([]);
  }, [getOrgUrl, setBreadcrumbs, t]);

  const handleOpenDetail = async (id: string) => {
    if (!orgId) return;
    setSelectedId(id);
    const invocation = await fetchModelCallDetail(orgId, id);
    setDetailTitle(invocation.displayName);
    setDetailContent(invocation.content || invocation.error || "");
  };

  return (
    <InsetLayout title={t("pages.modelCalls.title")}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : invocations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("pages.modelCalls.empty")}</p>
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
                <Badge
                  variant={
                    invocation.status === "completed" ? "default" : "destructive"
                  }
                >
                  {invocation.status}
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
