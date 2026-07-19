import {
  AI_MEDIA_CACHE_MAX_LIMIT_MB,
  AI_MEDIA_CACHE_MIN_LIMIT_MB,
} from "@dafthunk/types";
import Trash2 from "lucide-react/icons/trash-2";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  notifyAiMediaCacheChanged,
  useAiMediaCacheStats,
} from "@/hooks/use-ai-media-cache";
import {
  clearAiMediaCache,
  formatBytes,
  setAiMediaCacheSettings,
} from "@/services/ai-media-cache-service";
import { cn } from "@/utils/utils";

interface AiMediaCachePanelProps {
  readonly organizationId: string;
  readonly currentWorkflowId?: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function AiMediaCacheBar({
  organizationId,
  currentWorkflowId,
}: {
  readonly organizationId: string;
  readonly currentWorkflowId?: string;
}) {
  const { t } = useTranslation();
  const { stats } = useAiMediaCacheStats(organizationId);
  const [open, setOpen] = useState(false);

  const label = useMemo(() => {
    if (!stats) return t("workflow.aiMediaCache.loading");
    if (!stats.enabled) return t("workflow.aiMediaCache.disabled");
    return t("workflow.aiMediaCache.barUsage", {
      used: formatBytes(stats.totalBytes),
      limit: formatBytes(stats.limitBytes),
    });
  }, [stats, t]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 shadow-xs hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
      >
        {t("workflow.aiMediaCache.barLabel")}: {label}
      </button>
      <AiMediaCachePanel
        organizationId={organizationId}
        currentWorkflowId={currentWorkflowId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function AiMediaCachePanel({
  organizationId,
  currentWorkflowId,
  open,
  onOpenChange,
}: AiMediaCachePanelProps) {
  const { t } = useTranslation();
  const { stats, refresh } = useAiMediaCacheStats(organizationId);
  const [enabled, setEnabled] = useState(true);
  const [limitMb, setLimitMb] = useState(1024);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingClearAll, setPendingClearAll] = useState(false);

  useEffect(() => {
    if (!stats) return;
    setEnabled(stats.enabled);
    setLimitMb(Math.round(stats.limitBytes / (1024 * 1024)));
  }, [stats]);

  const handleSaveSettings = useCallback(async () => {
    await setAiMediaCacheSettings({
      enabled,
      limitMb,
    });
    notifyAiMediaCacheChanged();
    await refresh();
  }, [enabled, limitMb, refresh]);

  const handleToggleWorkflow = (workflowId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(workflowId);
      else next.delete(workflowId);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (!stats) return;
    if (checked) {
      setSelected(new Set(stats.workflows.map((row) => row.workflowId)));
    } else {
      setSelected(new Set());
    }
  };

  const runClear = async (workflowIds?: string[]) => {
    await clearAiMediaCache({
      organizationId,
      workflowIds,
    });
    notifyAiMediaCacheChanged();
    setSelected(new Set());
    await refresh();
  };

  const workflows = stats?.workflows ?? [];
  const allSelected =
    workflows.length > 0 && selected.size === workflows.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("workflow.aiMediaCache.panelTitle")}</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            {t("workflow.aiMediaCache.panelHint")}
          </p>

          <div className="space-y-4 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ai-cache-enabled">
                {t("workflow.aiMediaCache.enabledLabel")}
              </Label>
              <Switch
                id="ai-cache-enabled"
                checked={enabled}
                onCheckedChange={(value) => {
                  setEnabled(value);
                  void setAiMediaCacheSettings({ enabled: value }).then(() => {
                    notifyAiMediaCacheChanged();
                    void refresh();
                  });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-cache-limit">
                {t("workflow.aiMediaCache.limitLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="ai-cache-limit"
                  type="number"
                  min={AI_MEDIA_CACHE_MIN_LIMIT_MB}
                  max={AI_MEDIA_CACHE_MAX_LIMIT_MB}
                  value={limitMb}
                  onChange={(event) =>
                    setLimitMb(Number(event.target.value) || AI_MEDIA_CACHE_MIN_LIMIT_MB)
                  }
                  onBlur={() => void handleSaveSettings()}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">MB</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("workflow.aiMediaCache.limitRange", {
                  min: AI_MEDIA_CACHE_MIN_LIMIT_MB,
                  max: AI_MEDIA_CACHE_MAX_LIMIT_MB,
                })}
              </p>
            </div>

            {stats ? (
              <div className="text-sm">
                <p>
                  {t("workflow.aiMediaCache.currentUsage", {
                    used: formatBytes(stats.totalBytes),
                    limit: formatBytes(stats.limitBytes),
                  })}
                </p>
                {stats.browserQuotaBytes ? (
                  <p className="text-xs text-muted-foreground">
                    {t("workflow.aiMediaCache.browserQuota", {
                      quota: formatBytes(stats.browserQuotaBytes),
                    })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="select-all-workflows"
                type="checkbox"
                checked={allSelected}
                onChange={(event) => handleSelectAll(event.target.checked)}
                className="size-4 rounded border"
              />
              <Label htmlFor="select-all-workflows">
                {t("workflow.aiMediaCache.selectAll")}
              </Label>
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
              {workflows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("workflow.aiMediaCache.empty")}
                </p>
              ) : (
                workflows.map((row) => (
                  <label
                    key={row.workflowId}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50",
                      row.workflowId === currentWorkflowId && "bg-muted/30"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(row.workflowId)}
                      onChange={(event) =>
                        handleToggleWorkflow(row.workflowId, event.target.checked)
                      }
                      className="size-4 rounded border"
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="truncate font-medium">
                        {row.workflowName || row.workflowId}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("workflow.aiMediaCache.workflowCounts", {
                          images: row.imageCount,
                          videos: row.videoCount,
                          size: formatBytes(row.totalBytes),
                        })}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={selected.size === 0}
              onClick={() => {
                setPendingClearAll(false);
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="mr-1 size-4" />
              {t("workflow.aiMediaCache.clearSelected")}
            </Button>
            <Button
              variant="destructive"
              disabled={workflows.length === 0}
              onClick={() => {
                setPendingClearAll(true);
                setConfirmOpen(true);
              }}
            >
              {t("workflow.aiMediaCache.clearAll")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("workflow.aiMediaCache.confirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("workflow.aiMediaCache.confirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void runClear(
                  pendingClearAll ? undefined : Array.from(selected)
                ).then(() => setConfirmOpen(false));
              }}
            >
              {t("workflow.aiMediaCache.confirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
