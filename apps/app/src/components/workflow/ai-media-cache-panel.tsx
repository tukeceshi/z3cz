import {
  AI_MEDIA_CACHE_MAX_LIMIT_MB,
  AI_MEDIA_CACHE_MIN_LIMIT_MB,
} from "@dafthunk/types";
import ChevronDown from "lucide-react/icons/chevron-down";
import ChevronRight from "lucide-react/icons/chevron-right";
import Download from "lucide-react/icons/download";
import RefreshCw from "lucide-react/icons/refresh-cw";
import Trash2 from "lucide-react/icons/trash-2";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  clearCacheEntriesByKeys,
  deleteCacheResourceTiers,
  downloadCacheForWorkflows,
  formatBytes,
  getCacheResourcePreviewUrl,
  listWorkflowCacheResources,
  regenerateCacheResourceTiers,
  setAiMediaCacheSettings,
  type AiMediaCacheResourceSummary,
  type AiMediaCacheTierKind,
} from "@/services/ai-media-cache-service";
import { cn } from "@/utils/utils";

interface AiMediaCachePanelProps {
  readonly organizationId: string;
  readonly currentWorkflowId?: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

function tierLabelKey(tier: AiMediaCacheTierKind): string {
  if (tier === "thumb") return "workflow.aiMediaCache.tierThumb";
  if (tier === "canvas-s") return "workflow.aiMediaCache.tierCanvasS";
  if (tier === "canvas-m") return "workflow.aiMediaCache.tierCanvasM";
  return "workflow.aiMediaCache.tierCanvasL";
}

function CacheResourcePreview({
  entryKey,
  nodeType,
}: {
  readonly entryKey: string;
  readonly nodeType: AiMediaCacheResourceSummary["nodeType"];
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCacheResourcePreviewUrl(entryKey).then((url) => {
      if (!cancelled) {
        setPreviewUrl(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entryKey]);

  if (nodeType === "ai-audio") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded border bg-muted/40 text-[10px] text-muted-foreground">
        MP3
      </div>
    );
  }

  if (!previewUrl) {
    return <div className="size-10 shrink-0 rounded border bg-muted/40" />;
  }

  return (
    <img
      src={previewUrl}
      alt=""
      className="size-10 shrink-0 rounded border object-cover"
    />
  );
}

function WorkflowResourceList({
  organizationId,
  workflowId,
  onChanged,
}: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [resources, setResources] = useState<readonly AiMediaCacheResourceSummary[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listWorkflowCacheResources({
        organizationId,
        workflowId,
      });
      setResources(rows);
    } finally {
      setLoading(false);
    }
  }, [organizationId, workflowId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleDeleteResource = useCallback(
    async (entryKey: string) => {
      await clearCacheEntriesByKeys([entryKey]);
      notifyAiMediaCacheChanged();
      await reload();
      await onChanged();
    },
    [onChanged, reload]
  );

  const handleDeleteThumbs = useCallback(
    async (entryKey: string) => {
      await deleteCacheResourceTiers(entryKey);
      notifyAiMediaCacheChanged();
      await reload();
      await onChanged();
    },
    [onChanged, reload]
  );

  const handleRegenerateThumbs = useCallback(
    async (entryKey: string) => {
      await regenerateCacheResourceTiers(entryKey);
      notifyAiMediaCacheChanged();
      await reload();
      await onChanged();
    },
    [onChanged, reload]
  );

  if (loading) {
    return (
      <p className="px-2 py-1 text-xs text-muted-foreground">
        {t("workflow.aiMediaCache.loading")}
      </p>
    );
  }

  if (resources.length === 0) {
    return (
      <p className="px-2 py-1 text-xs text-muted-foreground">
        {t("workflow.aiMediaCache.resourceEmpty")}
      </p>
    );
  }

  return (
    <div className="space-y-2 border-t pt-2">
      {resources.map((resource) => (
        <div
          key={resource.entryKey}
          className="rounded-md border bg-background/60 p-2"
        >
          <div className="flex items-start gap-2">
            <CacheResourcePreview
              entryKey={resource.entryKey}
              nodeType={resource.nodeType}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">
                {t(
                  resource.nodeType === "ai-video"
                    ? "workflow.aiMediaCache.entryVideo"
                    : resource.nodeType === "ai-audio"
                      ? "workflow.aiMediaCache.entryAudio"
                      : "workflow.aiMediaCache.entryImage"
                )}{" "}
                · {resource.mediaId.slice(0, 12)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t("workflow.aiMediaCache.resourceSizeBreakdown", {
                  original: formatBytes(resource.originalBytes),
                  thumbs: formatBytes(resource.thumbBytes),
                  total: formatBytes(resource.totalBytes),
                })}
              </div>
              {resource.tiers.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {resource.tiers.map((tier) => (
                    <span
                      key={`${resource.entryKey}-${tier.tier}`}
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {t(tierLabelKey(tier.tier))} {formatBytes(tier.byteSize)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("workflow.aiMediaCache.noThumbs")}
                </p>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => void handleRegenerateThumbs(resource.entryKey)}
            >
              <RefreshCw className="mr-1 size-3" />
              {t("workflow.aiMediaCache.regenerateThumbs")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={resource.thumbBytes <= 0}
              onClick={() => void handleDeleteThumbs(resource.entryKey)}
            >
              {t("workflow.aiMediaCache.deleteThumbs")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => void handleDeleteResource(resource.entryKey)}
            >
              <Trash2 className="mr-1 size-3" />
              {t("workflow.aiMediaCache.deleteResource")}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
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
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(
    null
  );
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmDownloadOpen, setConfirmDownloadOpen] = useState(false);
  const [pendingClearAll, setPendingClearAll] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!stats) return;
    setEnabled(stats.enabled);
    setLimitMb(Math.round(stats.limitBytes / (1024 * 1024)));
  }, [stats]);

  useEffect(() => {
    if (!open) {
      setExpandedWorkflowId(null);
    }
  }, [open]);

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
    setExpandedWorkflowId(null);
    await refresh();
  };

  const runDownloadSelected = async () => {
    setDownloading(true);
    try {
      await downloadCacheForWorkflows({
        organizationId,
        workflowIds: Array.from(selected),
      });
    } finally {
      setDownloading(false);
    }
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
              <div className="space-y-1 text-sm">
                <p>
                  {t("workflow.aiMediaCache.currentUsage", {
                    used: formatBytes(stats.totalBytes),
                    limit: formatBytes(stats.limitBytes),
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("workflow.aiMediaCache.usageBreakdown", {
                    original: formatBytes(stats.originalBytes),
                    thumbs: formatBytes(stats.thumbBytes),
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
                disabled={workflows.length === 0}
                onChange={(event) => handleSelectAll(event.target.checked)}
                className="size-4 rounded border"
              />
              <Label htmlFor="select-all-workflows">
                {t("workflow.aiMediaCache.selectAll")}
              </Label>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-2">
              {workflows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("workflow.aiMediaCache.empty")}
                </p>
              ) : (
                workflows.map((row) => {
                  const isExpanded = expandedWorkflowId === row.workflowId;
                  return (
                    <div
                      key={row.workflowId}
                      className={cn(
                        "rounded-md border px-2 py-1.5",
                        row.workflowId === currentWorkflowId && "border-primary/30 bg-muted/20"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(row.workflowId)}
                          onChange={(event) =>
                            handleToggleWorkflow(row.workflowId, event.target.checked)
                          }
                          className="mt-1 size-4 rounded border"
                        />
                        <button
                          type="button"
                          className="mt-0.5 text-muted-foreground"
                          onClick={() =>
                            setExpandedWorkflowId((current) =>
                              current === row.workflowId ? null : row.workflowId
                            )
                          }
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1 text-sm">
                          <div className="truncate font-medium">
                            {row.workflowName || row.workflowId}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("workflow.aiMediaCache.workflowCounts", {
                              total:
                                row.entryCount ??
                                row.imageCount +
                                  row.videoCount +
                                  (row.audioCount ?? 0),
                              images: row.imageCount,
                              videos: row.videoCount,
                              audios: row.audioCount ?? 0,
                              size: formatBytes(row.totalBytes),
                            })}
                          </div>
                        </div>
                      </div>
                      {isExpanded ? (
                        <WorkflowResourceList
                          organizationId={organizationId}
                          workflowId={row.workflowId}
                          onChanged={refresh}
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={selected.size === 0 || downloading}
              onClick={() => setConfirmDownloadOpen(true)}
            >
              <Download className="mr-1 size-4" />
              {t("workflow.aiMediaCache.downloadSelected", {
                count: selected.size,
              })}
            </Button>
            <Button
              variant="outline"
              disabled={selected.size === 0}
              onClick={() => {
                setPendingClearAll(false);
                setConfirmClearOpen(true);
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
                setConfirmClearOpen(true);
              }}
            >
              {t("workflow.aiMediaCache.clearAll")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
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
              onClick={(event) => {
                event.preventDefault();
                void runClear(
                  pendingClearAll ? undefined : Array.from(selected)
                ).then(() => setConfirmClearOpen(false));
              }}
            >
              {t("workflow.aiMediaCache.confirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDownloadOpen}
        onOpenChange={setConfirmDownloadOpen}
      >
        <AlertDialogContent>
          <Alert variant="destructive" className="mb-2">
            <AlertTitle>
              {t("workflow.aiMediaCache.downloadWarningTitle")}
            </AlertTitle>
            <AlertDescription>
              {t("workflow.aiMediaCache.downloadWarningDescription")}
            </AlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={downloading}
              onClick={() => {
                void runDownloadSelected().then(() =>
                  setConfirmDownloadOpen(false)
                );
              }}
            >
              {downloading
                ? t("workflow.aiMediaCache.downloading")
                : t("workflow.aiMediaCache.downloadConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
