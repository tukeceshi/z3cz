import type { CharacterLibraryEntry, WorkflowMediaValue } from "@dafthunk/types";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReferenceThumbUrl } from "@/hooks/use-reference-thumb-url";
import {
  addCharacterLibraryEntry,
  fetchCharacterLibraryImportStatus,
  importCharacterLibraryEntry,
  listCharacterLibraryEntries,
  removeCharacterLibraryEntry,
} from "@/services/character-library";
import { listWorkflowCacheResources } from "@/services/ai-media-cache-service";
import { cn } from "@/utils/utils";

import { MediaDisplayLoadingPlaceholder } from "./media-display-loading-placeholder";

function CharacterMediaThumb({
  entry,
}: {
  readonly entry: CharacterLibraryEntry;
}) {
  const media: WorkflowMediaValue = {
    resourceId: entry.resourceId,
    kind: entry.kind,
    mimeType: entry.mimeType,
  };
  const nodeType = entry.mimeType.startsWith("video/")
    ? ("ai-video" as const)
    : ("ai-image" as const);
  const { displayUrl, phase } = useReferenceThumbUrl({ media, nodeType });

  if (displayUrl) {
    return (
      <img
        src={displayUrl}
        alt={entry.resourceId}
        className="h-full w-full object-cover"
      />
    );
  }
  if (phase === "loading") {
    return <MediaDisplayLoadingPlaceholder className="h-full w-full" />;
  }
  return <span className="text-muted-foreground text-[10px]">N/A</span>;
}

interface CharacterLibraryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly interfaceId?: string;
  readonly onInsert: (entry: CharacterLibraryEntry) => void;
}

/** Character candidates come only from the current canvas's AI media cache. */
async function loadCachedCanvasResources(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
}): Promise<readonly CharacterLibraryEntry[]> {
  if (!params.workflowId) {
    return [];
  }
  const rows = await listWorkflowCacheResources({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });
  return rows
    .filter(
      (row) =>
        row.mimeType.startsWith("image/") || row.mimeType.startsWith("video/")
    )
    .map((row) => ({
      resourceId: row.mediaId,
      kind: "cloud" as const,
      mimeType: row.mimeType,
      modelCanonicalId: null,
      interfaceId: null,
      createdAt: row.createdAt,
    }));
}

export function CharacterLibraryDialog({
  open,
  onOpenChange,
  organizationId,
  interfaceId,
  onInsert,
}: CharacterLibraryDialogProps) {
  const { t } = useTranslation();
  const { id: workflowId } = useParams<{ id: string }>();
  const [entries, setEntries] = useState<readonly CharacterLibraryEntry[]>([]);
  const [available, setAvailable] = useState<readonly CharacterLibraryEntry[]>(
    []
  );
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [importingIds, setImportingIds] = useState<ReadonlySet<string>>(
    new Set()
  );
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [library, resources] = await Promise.all([
        listCharacterLibraryEntries({ organizationId, interfaceId }),
        loadCachedCanvasResources({ organizationId, workflowId }),
      ]);
      setEntries(library);
      setAvailable(resources);
    } catch {
      setEntries([]);
      setAvailable([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organizationId, workflowId]);

  // Poll upstream import status while any entry is pending.
  useEffect(() => {
    if (!open || !organizationId) return;
    const pendingIds = entries
      .filter((entry) => entry.upstreamAssetStatus === "pending")
      .map((entry) => entry.resourceId);
    if (pendingIds.length === 0) return;

    let cancelled = false;
    const poll = async () => {
      for (const resourceId of pendingIds) {
        if (cancelled) return;
        try {
          const status = await fetchCharacterLibraryImportStatus({
            organizationId,
            resourceId,
          });
          setEntries((current) =>
            current.map((entry) =>
              entry.resourceId === resourceId
                ? { ...entry, upstreamAssetStatus: status }
                : entry
            )
          );
        } catch {
          // Transient upstream errors: keep polling until it settles.
        }
      }
      if (!cancelled) {
        pollTimerRef.current = setTimeout(() => void poll(), 3000);
      }
    };
    pollTimerRef.current = setTimeout(() => void poll(), 3000);
    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [open, organizationId, entries]);

  const runImport = async (resourceId: string) => {
    if (!organizationId) return;
    setImportingIds((current) => new Set(current).add(resourceId));
    try {
      const updated = await importCharacterLibraryEntry({
        organizationId,
        resourceId,
      });
      setEntries((current) =>
        current.some((entry) => entry.resourceId === resourceId)
          ? current.map((entry) =>
              entry.resourceId === resourceId ? updated : entry
            )
          : [...current, updated]
      );
    } catch {
      setEntries((current) =>
        current.map((entry) =>
          entry.resourceId === resourceId
            ? { ...entry, upstreamAssetStatus: "failed" }
            : entry
        )
      );
    } finally {
      setImportingIds((current) => {
        const next = new Set(current);
        next.delete(resourceId);
        return next;
      });
    }
  };

  const handleAdd = async (entry: CharacterLibraryEntry) => {
    await addCharacterLibraryEntry({
      organizationId,
      resourceId: entry.resourceId,
      ...(interfaceId ? { interfaceId } : {}),
    });
    setPicking(false);
    await refresh();
    void runImport(entry.resourceId);
  };

  const handleRemove = async (resourceId: string) => {
    await removeCharacterLibraryEntry({ organizationId, resourceId });
    setPendingDelete(null);
    await refresh();
  };

  const visible = picking ? available : entries;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("workflow.characterLibrary.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("workflow.characterLibrary.title")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          {picking ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPicking(false)}
            >
              {t("workflow.characterLibrary.backToList")}
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={picking}
            onClick={() => setPicking(true)}
          >
            {t("workflow.characterLibrary.addFromExisting")}
          </Button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <MediaDisplayLoadingPlaceholder className="h-8 w-8" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {picking
              ? t("workflow.characterLibrary.availableEmpty")
              : t("workflow.characterLibrary.empty")}
          </div>
        ) : (
          <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto">
            {visible.map((entry) => {
              const isImporting = importingIds.has(entry.resourceId);
              const status =
                entry.upstreamAssetStatus ??
                (isImporting ? "pending" : undefined);
              return (
              <div
                key={entry.resourceId}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-background"
              >
                <CharacterMediaThumb entry={entry} />
                {status && !picking ? (
                  <span
                    className={cn(
                      "absolute left-1 top-1 rounded px-1 py-px text-[9px] font-medium text-white",
                      status === "active" && "bg-emerald-600",
                      status === "pending" && "bg-amber-500",
                      status === "failed" && "bg-destructive"
                    )}
                  >
                    {status === "active"
                      ? t("workflow.characterLibrary.statusActive")
                      : status === "failed"
                        ? t("workflow.characterLibrary.statusFailed")
                        : t("workflow.characterLibrary.statusImporting")}
                  </span>
                ) : null}
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity",
                    "group-hover:opacity-100"
                  )}
                >
                  {picking ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleAdd(entry)}
                    >
                      {t("workflow.characterLibrary.add")}
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          onInsert(entry);
                          onOpenChange(false);
                        }}
                      >
                        {t("workflow.characterLibrary.insertToCanvas")}
                      </Button>
                      {status === "failed" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white hover:text-white"
                          onClick={() => void runImport(entry.resourceId)}
                        >
                          {t("workflow.characterLibrary.retryImport")}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:text-white"
                        onClick={() => setPendingDelete(entry.resourceId)}
                      >
                        {t("workflow.characterLibrary.delete")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}

        {pendingDelete ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium">
              {t("workflow.characterLibrary.deleteConfirmTitle")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t("workflow.characterLibrary.deleteConfirmDescription")}
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPendingDelete(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleRemove(pendingDelete)}
              >
                {t("workflow.characterLibrary.delete")}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
