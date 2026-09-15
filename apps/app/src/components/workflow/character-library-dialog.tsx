import type {
  CharacterLibraryEntry,
  WorkflowMediaValue,
} from "@dafthunk/types";
import PlayIcon from "lucide-react/icons/play";
import PlusIcon from "lucide-react/icons/plus";
import RotateCcwIcon from "lucide-react/icons/rotate-ccw";
import Trash2Icon from "lucide-react/icons/trash-2";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaDisplayUrlSet } from "@/hooks/use-media-display-url-set";
import { listWorkflowCacheResources } from "@/services/ai-media-cache-service";
import {
  addCharacterLibraryEntry,
  fetchCharacterLibraryImportStatus,
  importCharacterLibraryEntry,
  listCharacterLibraryEntries,
  removeCharacterLibraryEntry,
} from "@/services/character-library";
import { resolveMediaDisplay } from "@/services/media-display-readiness";
import { cn } from "@/utils/utils";

import { MediaDisplayLoadingPlaceholder } from "./media-display-loading-placeholder";
import { WorkflowMediaVideoPlayer } from "./workflow-media-video-player";

function mediaFromEntry(entry: CharacterLibraryEntry): WorkflowMediaValue {
  return {
    resourceId: entry.resourceId,
    kind: entry.kind,
    mimeType: entry.mimeType,
  };
}

function CharacterLibraryCover({
  entry,
  hovered,
}: {
  readonly entry: CharacterLibraryEntry;
  readonly hovered: boolean;
}) {
  const media = useMemo(
    () => mediaFromEntry(entry),
    [entry.kind, entry.mimeType, entry.resourceId]
  );
  const isVideo = entry.mimeType.startsWith("video/");
  const { urlSet, stale } = useMediaDisplayUrlSet({
    media,
    nodeType: isVideo ? "ai-video" : "ai-image",
    preferredSize: "canvas-l",
    ensureSize: isVideo && hovered ? "full" : undefined,
  });
  const posterUrl =
    urlSet.l ?? urlSet.m ?? urlSet.s ?? (isVideo ? null : urlSet.full);
  const fullDisplay = useMemo(
    () =>
      resolveMediaDisplay({
        media: isVideo && hovered ? media : null,
        urlSet,
        size: "full",
        stale,
      }),
    [hovered, isVideo, media, stale, urlSet]
  );
  const videoUrl =
    fullDisplay.phase === "ready" ? fullDisplay.displayUrl : null;
  const showPlayer = Boolean(isVideo && hovered && videoUrl);
  const showHoverLoading = Boolean(
    isVideo && hovered && !videoUrl && fullDisplay.phase === "loading"
  );

  if (!posterUrl) {
    if (stale) {
      return (
        <MediaDisplayLoadingPlaceholder className="absolute inset-0 size-full" />
      );
    }
    return (
      <span className="text-muted-foreground absolute inset-0 flex items-center justify-center text-[10px]">
        N/A
      </span>
    );
  }

  return (
    <>
      <img
        src={posterUrl}
        alt=""
        className={cn(
          "absolute inset-0 size-full object-cover",
          showPlayer && "pointer-events-none opacity-0"
        )}
      />
      {isVideo && !showPlayer && !showHoverLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
          <PlayIcon className="h-8 w-8 text-white/85" strokeWidth={1.75} />
        </div>
      ) : null}
      {showPlayer && videoUrl ? (
        <WorkflowMediaVideoPlayer
          key={videoUrl}
          src={videoUrl}
          variant="card"
          objectFit="cover"
          initialHovered
          className="absolute inset-0 z-10"
        />
      ) : null}
      {showHoverLoading ? (
        <MediaDisplayLoadingPlaceholder className="absolute inset-0 z-10 size-full" />
      ) : null}
    </>
  );
}

function CardIconButton({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex size-6 items-center justify-center rounded bg-black/65 text-white backdrop-blur-[2px] hover:bg-black/80"
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function CharacterLibraryItem({
  entry,
  picking,
  status,
  onAdd,
  onInsert,
  onRetry,
  onDelete,
}: {
  readonly entry: CharacterLibraryEntry;
  readonly picking: boolean;
  readonly status: "active" | "pending" | "failed" | undefined;
  readonly onAdd: () => void;
  readonly onInsert: () => void;
  readonly onRetry: () => void;
  readonly onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative aspect-square w-full overflow-hidden rounded-xl border border-border"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CharacterLibraryCover entry={entry} hovered={hovered} />
      {status && !picking ? (
        <span
          className={cn(
            "absolute left-2 top-2 z-20 rounded px-1 py-px text-[9px] font-medium text-white",
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
      <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-end justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        {picking ? (
          <CardIconButton
            label={t("workflow.characterLibrary.add")}
            onClick={onAdd}
          >
            <PlusIcon className="size-3" />
          </CardIconButton>
        ) : (
          <>
            {status === "active" ? (
              <CardIconButton
                label={t("workflow.characterLibrary.insertToCanvas")}
                onClick={onInsert}
              >
                <PlusIcon className="size-3" />
              </CardIconButton>
            ) : null}
            {status === "failed" ? (
              <CardIconButton
                label={t("workflow.characterLibrary.retryImport")}
                onClick={onRetry}
              >
                <RotateCcwIcon className="size-3" />
              </CardIconButton>
            ) : null}
            <CardIconButton
              label={t("workflow.characterLibrary.delete")}
              onClick={onDelete}
            >
              <Trash2Icon className="size-3" />
            </CardIconButton>
          </>
        )}
      </div>
    </div>
  );
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
  const [groupId, setGroupId] = useState<string | null>(null);
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
      setEntries(library.entries);
      setGroupId(library.groupId);
      setAvailable(resources);
    } catch {
      setEntries([]);
      setGroupId(null);
      setAvailable([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void refresh();
      return;
    }
    setPicking(false);
    setPendingDelete(null);
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
  const showEmpty = !loading && picking && visible.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(720px,calc(100vh-2rem))] w-[min(1000px,calc(100vw-2rem))] max-w-[1000px] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
          <DialogTitle className="text-sm font-medium">
            {picking
              ? t("workflow.characterLibrary.addFromExisting")
              : t("workflow.characterLibrary.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("workflow.characterLibrary.title")}
          </DialogDescription>
          {picking ? (
            <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
              {t("workflow.characterLibrary.backToList")}
            </Button>
          ) : null}
        </div>

        <TooltipProvider delayDuration={0}>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <MediaDisplayLoadingPlaceholder className="h-8 w-8" />
              </div>
            ) : showEmpty ? (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                {t("workflow.characterLibrary.availableEmpty")}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {picking ? null : (
                  <button
                    type="button"
                    className="bg-muted/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-border px-4 text-center text-sm transition"
                    onClick={() => setPicking(true)}
                  >
                    <PlusIcon className="size-6" />
                    {t("workflow.characterLibrary.addFromExisting")}
                  </button>
                )}
                {visible.map((entry) => {
                  const isImporting = importingIds.has(entry.resourceId);
                  const status =
                    entry.upstreamAssetStatus ??
                    (isImporting ? "pending" : undefined);
                  return (
                    <CharacterLibraryItem
                      key={entry.resourceId}
                      entry={entry}
                      picking={picking}
                      status={status}
                      onAdd={() => void handleAdd(entry)}
                      onInsert={() => {
                        onInsert(entry);
                        onOpenChange(false);
                      }}
                      onRetry={() => void runImport(entry.resourceId)}
                      onDelete={() => setPendingDelete(entry.resourceId)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </TooltipProvider>

        {pendingDelete ? (
          <div className="border-destructive/40 bg-destructive/5 shrink-0 border-t px-4 py-3 text-sm">
            <p className="font-medium">
              {t("workflow.characterLibrary.deleteConfirmTitle")}
            </p>
            <p className="text-muted-foreground mt-1">
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
        ) : (
          <div className="flex h-[60px] shrink-0 items-center border-t px-4">
            <span className="text-muted-foreground truncate text-xs">
              {t("workflow.characterLibrary.assetGroupId")}
              {groupId
                ? `：${groupId}`
                : `：${t("workflow.characterLibrary.groupNotCreated")}`}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
