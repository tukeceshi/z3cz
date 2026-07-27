import type { WorkflowFolder, WorkflowWithMetadata } from "@dafthunk/types";
import { WORKFLOW_SCHEME_BASIC_CANVAS_ID } from "@dafthunk/types";
import FolderPlus from "lucide-react/icons/folder-plus";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import PlusCircle from "lucide-react/icons/plus-circle";
import Wand from "lucide-react/icons/wand";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "@/components/auth-context";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { useTranslation } from "@/components/locale-provider";
import { ChangeCoverDialog } from "@/components/workflow/change-cover-dialog";
import { DeleteFolderDialog } from "@/components/workflow/delete-folder-dialog";
import { RenameLibraryItemDialog } from "@/components/workflow/rename-library-item-dialog";
import { createWorkflowEditorLocationState } from "@/components/workflow/workflow-editor-navigation";
import {
  hasLibraryCover,
} from "@/components/workflow/workflow-library-utils";
import { WorkflowLibraryPreview } from "@/components/workflow/workflow-library-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import { useAppToast } from "@/hooks/use-app-toast";
import { uploadBinaryData } from "@/services/object-service";
import { useOrgCloudStorageConfigured } from "@/services/platform-ai-model-service";
import {
  createWorkflowFolder,
  deleteWorkflowFolder,
  updateWorkflowFolder,
  useWorkflowFolder,
  useWorkflowFolders,
} from "@/services/workflow-folder-service";
import {
  createWorkflow,
  deleteWorkflow,
  updateWorkflowListMetadata,
  useWorkflows,
} from "@/services/workflow-service";
import {
  prefetchWorkflowEditorSession,
  schedulePrefetchWorkflowEditorChunks,
} from "@/utils/workflow-editor-prefetch";
import { formatRelativeDate } from "@/utils/date";

interface WorkflowLibraryViewProps {
  folderId?: string | null;
}

type CoverTarget =
  | { kind: "workflow"; item: WorkflowWithMetadata }
  | { kind: "folder"; item: WorkflowFolder };

type RenameTarget =
  | { kind: "workflow"; item: WorkflowWithMetadata }
  | { kind: "folder"; item: WorkflowFolder };

type LibraryEntry =
  | { kind: "folder"; item: WorkflowFolder }
  | { kind: "workflow"; item: WorkflowWithMetadata };

export function WorkflowLibraryView({ folderId = null }: WorkflowLibraryViewProps) {
  const { t } = useTranslation();
  const perms = useOrgPermissions();
  const navigate = useNavigate();
  const appToast = useAppToast();
  const { organization } = useAuth();
  const orgId = organization?.id ?? "";
  const { getOrgUrl } = useOrgUrl();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);

  const isRoot = folderId === null;
  const listFolderId = isRoot ? null : folderId;

  const { folder, folderError, isFolderLoading } = useWorkflowFolder(
    isRoot ? undefined : folderId ?? undefined
  );
  const {
    folders,
    foldersError,
    isFoldersLoading,
    mutateFolders,
  } = useWorkflowFolders();
  const {
    workflows,
    workflowsError,
    isWorkflowsLoading,
    mutateWorkflows,
  } = useWorkflows(listFolderId);
  const { configured: cloudStorageConfigured } = useOrgCloudStorageConfigured(orgId);

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [coverTarget, setCoverTarget] = useState<CoverTarget | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<WorkflowFolder | null>(
    null
  );
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] =
    useState<WorkflowWithMetadata | null>(null);
  const [isDeletingWorkflow, setIsDeletingWorkflow] = useState(false);

  useEffect(() => {
    schedulePrefetchWorkflowEditorChunks();
  }, []);

  useEffect(() => {
    if (isRoot) {
      setBreadcrumbs([{ label: t("pages.workflows.title") }]);
      return;
    }
    setBreadcrumbs([
      { label: t("pages.workflows.title"), to: getOrgUrl("workflows") },
      { label: folder?.name ?? t("pages.workflows.folders.loading") },
    ]);
  }, [isRoot, setBreadcrumbs, t, getOrgUrl, folder?.name]);

  const term = searchQuery.toLowerCase().trim();

  const filteredFolders = useMemo(() => {
    if (!isRoot) {
      return [];
    }
    if (!term) {
      return folders;
    }
    return folders.filter((item) => item.name.toLowerCase().includes(term));
  }, [folders, isRoot, term]);

  const filteredWorkflows = useMemo(() => {
    if (!term) {
      return workflows;
    }
    return workflows.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.description ?? "").toLowerCase().includes(term)
    );
  }, [workflows, term]);

  const libraryEntries = useMemo((): LibraryEntry[] => {
    const entries: LibraryEntry[] = [
      ...filteredFolders.map((item) => ({ kind: "folder" as const, item })),
      ...filteredWorkflows.map((item) => ({ kind: "workflow" as const, item })),
    ];
    return entries.sort(
      (a, b) =>
        new Date(b.item.updatedAt).getTime() -
        new Date(a.item.updatedAt).getTime()
    );
  }, [filteredFolders, filteredWorkflows]);

  const isLoading =
    isWorkflowsLoading || (isRoot ? isFoldersLoading : isFolderLoading);
  const loadError = workflowsError ?? foldersError ?? folderError;

  const handleCreateWorkflow = async (name: string, description?: string) => {
    if (!orgId) {
      return;
    }
    try {
      const newWorkflow = await createWorkflow(
        {
          name,
          description,
          schemeId: WORKFLOW_SCHEME_BASIC_CANVAS_ID,
          trigger: "manual",
          runtime: "workflow",
          folderId: isRoot ? null : folderId,
          nodes: [],
          edges: [],
        },
        orgId
      );
      await mutateWorkflows();
      if (isRoot) {
        await mutateFolders();
      }
      prefetchWorkflowEditorSession(
        newWorkflow.id,
        orgId,
        WORKFLOW_SCHEME_BASIC_CANVAS_ID
      );
      navigate(getOrgUrl(`workflows/${newWorkflow.id}`), {
        state: createWorkflowEditorLocationState(),
      });
    } catch (error) {
      console.error("Failed to create workflow:", error);
      appToast.error("errors.workflowUpdateFailed");
      throw error;
    }
  };

  const handleQuickCreateWorkflow = async () => {
    if (isCreatingWorkflow) {
      return;
    }
    setIsCreatingWorkflow(true);
    try {
      await handleCreateWorkflow(t("pages.workflows.defaultName"));
    } catch {
      // Error toast handled in handleCreateWorkflow.
    } finally {
      setIsCreatingWorkflow(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!orgId || !perms.canEditWorkflows) {
      return;
    }
    setIsCreatingFolder(true);
    try {
      await createWorkflowFolder(
        { name: t("pages.workflows.folders.defaultName") },
        orgId
      );
      await mutateFolders();
      appToast.success("pages.workflows.folders.created");
    } catch (error) {
      console.error("Failed to create folder:", error);
      appToast.error("errors.workflowUpdateFailed");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleRename = async (name: string) => {
    if (!orgId || !renameTarget) {
      return;
    }
    setIsRenaming(true);
    try {
      if (renameTarget.kind === "folder") {
        await updateWorkflowFolder(renameTarget.item.id, { name }, orgId);
        await mutateFolders();
      } else {
        await updateWorkflowListMetadata(
          renameTarget.item.id,
          { name },
          orgId
        );
        await mutateWorkflows();
      }
      setRenameTarget(null);
    } catch (error) {
      console.error("Failed to rename item:", error);
      appToast.error("errors.workflowUpdateFailed");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!orgId || !coverTarget) {
      return;
    }
    setIsCoverUploading(true);
    try {
      const reference = await uploadBinaryData(file, file.type, orgId);
      if (coverTarget.kind === "folder") {
        await updateWorkflowFolder(
          coverTarget.item.id,
          {
            coverObjectId: reference.id,
            coverMimeType: reference.mimeType,
          },
          orgId
        );
        await mutateFolders();
      } else {
        await updateWorkflowListMetadata(
          coverTarget.item.id,
          {
            coverObjectId: reference.id,
            coverMimeType: reference.mimeType,
          },
          orgId
        );
        await mutateWorkflows();
      }
      setCoverTarget(null);
      appToast.success("pages.workflows.cover.updated");
    } catch (error) {
      console.error("Failed to upload cover:", error);
      appToast.error("pages.workflows.cover.uploadFailed");
    } finally {
      setIsCoverUploading(false);
    }
  };

  const handleCoverClear = async () => {
    if (!orgId || !coverTarget) {
      return;
    }
    setIsCoverUploading(true);
    try {
      if (coverTarget.kind === "folder") {
        await updateWorkflowFolder(
          coverTarget.item.id,
          { coverObjectId: null, coverMimeType: null },
          orgId
        );
        await mutateFolders();
      } else {
        await updateWorkflowListMetadata(
          coverTarget.item.id,
          { coverObjectId: null, coverMimeType: null },
          orgId
        );
        await mutateWorkflows();
      }
      setCoverTarget(null);
      appToast.success("pages.workflows.cover.removed");
    } catch (error) {
      console.error("Failed to remove cover:", error);
      appToast.error("errors.workflowUpdateFailed");
    } finally {
      setIsCoverUploading(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!orgId || !folderToDelete) {
      return;
    }
    setIsDeletingFolder(true);
    try {
      await deleteWorkflowFolder(folderToDelete.id, orgId);
      await mutateFolders();
      await mutateWorkflows();
      setFolderToDelete(null);
      appToast.success("pages.workflows.folders.deleted");
    } catch (error) {
      console.error("Failed to delete folder:", error);
      appToast.error("errors.workflowUpdateFailed");
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!orgId || !workflowToDelete) {
      return;
    }
    setIsDeletingWorkflow(true);
    try {
      await deleteWorkflow(workflowToDelete.id, orgId);
      await mutateWorkflows();
      if (isRoot) {
        await mutateFolders();
      }
      setWorkflowToDelete(null);
      appToast.success("pages.workflows.deleted");
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      appToast.error("errors.workflowUpdateFailed");
    } finally {
      setIsDeletingWorkflow(false);
    }
  };

  if (!isRoot && isFolderLoading) {
    return <InsetLoading title={t("pages.workflows.title")} />;
  }

  if (!isRoot && !isFolderLoading && !folder) {
    return (
      <InsetError
        title={t("pages.workflows.title")}
        errorMessage={t("pages.workflows.folders.notFound")}
      />
    );
  }

  if (isLoading) {
    return <InsetLoading title={t("pages.workflows.title")} />;
  }

  if (loadError) {
    return (
      <InsetError
        title={t("pages.workflows.title")}
        errorMessage={loadError.message}
      />
    );
  }

  const isEmpty = libraryEntries.length === 0 && !term;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex min-h-10 items-center justify-between gap-3">
        {!isRoot ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to={getOrgUrl("workflows")}>{t("pages.workflows.back")}</Link>
          </Button>
        ) : (
          <div />
        )}
        {perms.canEditWorkflows ? (
          isRoot ? (
            <Button onClick={handleCreateFolder} disabled={isCreatingFolder}>
              <FolderPlus className="mr-2 size-4" />
              {t("pages.workflows.folders.create")}
            </Button>
          ) : (
            <Button
              onClick={handleQuickCreateWorkflow}
              disabled={isCreatingWorkflow}
            >
              <PlusCircle className="mr-2 size-4" />
              {t("pages.workflows.create")}
            </Button>
          )
        ) : null}
      </div>

      <Input
        placeholder={t("pages.workflows.searchPlaceholder")}
        className="mb-4 h-12 shrink-0 pl-4 text-base"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
      />

      <ScrollArea className="min-h-0 flex-1">
        {isEmpty && !perms.canEditWorkflows ? (
          <div className="py-12 text-center text-muted-foreground">
            <Wand className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-sm">{t("pages.workflows.emptyAll")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pr-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {perms.canEditWorkflows ? (
              <LibraryCreateCard
                label={t("pages.workflows.createCardTitle")}
                caption={t("pages.workflows.createCardCaption")}
                disabled={isCreatingWorkflow}
                onClick={handleQuickCreateWorkflow}
              />
            ) : null}

            {libraryEntries.map((entry) =>
              entry.kind === "folder" ? (
                <LibraryItemCard
                  key={`folder-${entry.item.id}`}
                  title={entry.item.name}
                  updatedAt={entry.item.updatedAt}
                  orgId={orgId}
                  coverObjectId={entry.item.coverObjectId}
                  coverMimeType={entry.item.coverMimeType}
                  variant="folder"
                  canEdit={perms.canEditWorkflows}
                  onOpen={() =>
                    navigate(getOrgUrl(`workflows/folders/${entry.item.id}`))
                  }
                  onRename={() =>
                    setRenameTarget({ kind: "folder", item: entry.item })
                  }
                  onChangeCover={() =>
                    setCoverTarget({ kind: "folder", item: entry.item })
                  }
                  onDelete={() => setFolderToDelete(entry.item)}
                />
              ) : (
                <LibraryItemCard
                  key={`workflow-${entry.item.id}`}
                  title={entry.item.name || t("pages.workflows.untitled")}
                  updatedAt={entry.item.updatedAt}
                  orgId={orgId}
                  coverObjectId={entry.item.coverObjectId}
                  coverMimeType={entry.item.coverMimeType}
                  variant="workflow"
                  fallbackLabel={
                    entry.item.name || t("pages.workflows.untitled")
                  }
                  canEdit={perms.canEditWorkflows}
                  onOpen={() => {
                    prefetchWorkflowEditorSession(
                      entry.item.id,
                      orgId,
                      entry.item.schemeId
                    );
                    navigate(getOrgUrl(`workflows/${entry.item.id}`), {
                      state: createWorkflowEditorLocationState(),
                    });
                  }}
                  onRename={() =>
                    setRenameTarget({ kind: "workflow", item: entry.item })
                  }
                  onChangeCover={() =>
                    setCoverTarget({ kind: "workflow", item: entry.item })
                  }
                  onDelete={() => setWorkflowToDelete(entry.item)}
                  onPrefetch={() =>
                    prefetchWorkflowEditorSession(
                      entry.item.id,
                      orgId,
                      entry.item.schemeId
                    )
                  }
                />
              )
            )}
          </div>
        )}
      </ScrollArea>

      <ChangeCoverDialog
        open={coverTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCoverTarget(null);
          }
        }}
        cloudStorageConfigured={cloudStorageConfigured}
        isUploading={isCoverUploading}
        onUpload={handleCoverUpload}
        onClear={handleCoverClear}
        hasCover={
          coverTarget
            ? hasLibraryCover(
                coverTarget.item.coverObjectId,
                coverTarget.item.coverMimeType
              )
            : false
        }
      />

      <RenameLibraryItemDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
          }
        }}
        initialName={renameTarget?.item.name ?? ""}
        title={t("pages.workflows.renameTitle")}
        isSaving={isRenaming}
        onSave={handleRename}
      />

      {folderToDelete ? (
        <DeleteFolderDialog
          open={folderToDelete !== null}
          onOpenChange={(open) => {
            if (!open) {
              setFolderToDelete(null);
            }
          }}
          folderName={folderToDelete.name}
          workflowCount={folderToDelete.workflowCount}
          isDeleting={isDeletingFolder}
          onConfirm={handleDeleteFolder}
        />
      ) : null}

      {workflowToDelete ? (
        <DeleteWorkflowConfirmDialog
          open={workflowToDelete !== null}
          onOpenChange={(open) => {
            if (!open) {
              setWorkflowToDelete(null);
            }
          }}
          workflowName={
            workflowToDelete.name || t("pages.workflows.untitled")
          }
          isDeleting={isDeletingWorkflow}
          onConfirm={handleDeleteWorkflow}
        />
      ) : null}
    </div>
  );
}

function LibraryCreateCard({
  label,
  caption,
  disabled = false,
  onClick,
}: {
  label: string;
  caption: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className={disabled ? "pointer-events-none opacity-60" : undefined}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full text-left transition-opacity hover:opacity-90 disabled:cursor-not-allowed"
      >
        <WorkflowLibraryPreview
          variant="create"
          orgId=""
          fallbackLabel={label}
        />
      </button>
      <p className="mt-2 truncate text-sm text-muted-foreground">{caption}</p>
    </div>
  );
}

function LibraryItemCard({
  title,
  updatedAt,
  orgId,
  coverObjectId,
  coverMimeType,
  variant,
  fallbackLabel,
  canEdit,
  onOpen,
  onRename,
  onChangeCover,
  onDelete,
  onPrefetch,
}: {
  title: string;
  updatedAt: Date | string;
  orgId: string;
  coverObjectId?: string | null;
  coverMimeType?: string | null;
  variant: "folder" | "workflow";
  fallbackLabel?: string;
  canEdit: boolean;
  onOpen: () => void;
  onRename: () => void;
  onChangeCover: () => void;
  onDelete: () => void;
  onPrefetch?: () => void;
}) {
  const { t, locale } = useTranslation();

  return (
    <div
      className="group"
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left transition-opacity hover:opacity-95"
      >
        <WorkflowLibraryPreview
          orgId={orgId}
          coverObjectId={coverObjectId}
          coverMimeType={coverMimeType}
          fallbackLabel={fallbackLabel}
          variant={variant}
        />
      </button>
      <div className="mt-2 flex min-h-8 items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(event) => event.stopPropagation()}
              >
                <span className="sr-only">{t("pages.workflows.openMenu")}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onRename();
                }}
              >
                {t("pages.workflows.rename")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onChangeCover();
                }}
              >
                {t("pages.workflows.cover.change")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
              >
                {t("pages.workflows.deleteWorkflow")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("pages.workflows.updated", {
          date: formatRelativeDate(updatedAt, locale),
        })}
      </p>
    </div>
  );
}

function DeleteWorkflowConfirmDialog({
  open,
  onOpenChange,
  workflowName,
  isDeleting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowName: string;
  isDeleting: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pages.workflows.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.workflows.deleteConfirm", { name: workflowName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? <Spinner className="mr-2 h-4 w-4" /> : null}
            {t("adminWorkflowSchemes.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
