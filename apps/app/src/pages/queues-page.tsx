import type { ColumnDef } from "@tanstack/react-table";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import PlusCircle from "lucide-react/icons/plus-circle";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-context";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useOwnerPageGuard } from "@/hooks/use-owner-page-guard";
import { QueueSnippetsDialog } from "@/components/queue-snippets-dialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { TranslateFn } from "@/i18n";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  createQueue,
  deleteQueue,
  updateQueue,
  useQueues,
} from "@/services/queue-service";

interface QueueRow {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

function createColumns(
  openSnippetsDialog: (queue: QueueRow) => void,
  openEditDialog: (queue: QueueRow) => void,
  openDeleteDialog: (queue: QueueRow) => void,
  t: TranslateFn
): ColumnDef<QueueRow>[] {
  return [
    {
      accessorKey: "name",
      header: t("common.name"),
      cell: ({ row }) => {
        const name = row.getValue("name") as string;
        return (
          <span className="font-medium">
            {name || t("pages.queues.untitled")}
          </span>
        );
      },
    },
    {
      id: "endpoint",
      header: t("pages.queues.endpoint"),
      cell: ({ row }) => {
        const queue = row.original;
        const endpoint = `/api/queues/${queue.id}/publish`;
        return (
          <span className="text-sm text-muted-foreground font-mono">
            {endpoint}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const queue = row.original;
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
                <DropdownMenuItem onClick={() => openSnippetsDialog(queue)}>
                  {t("pages.queues.integrate")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditDialog(queue)}>
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDeleteDialog(queue)}>
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}

export function QueuesPage() {
  const ownerGuard = useOwnerPageGuard("sidebar.queues");
  if (ownerGuard.blocked) return ownerGuard.gate;
  return <QueuesPageContent />;
}

function QueuesPageContent() {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [snippetsDialogOpen, setSnippetsDialogOpen] = useState(false);
  const [queueForSnippets, setQueueForSnippets] = useState<QueueRow | null>(
    null
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [queueToDelete, setQueueToDelete] = useState<QueueRow | null>(null);
  const [queueToEdit, setQueueToEdit] = useState<QueueRow | null>(null);
  const [editName, setEditName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { organization } = useAuth();
  const orgId = organization?.id || "";

  const { queues, queuesError, isQueuesLoading, mutateQueues } = useQueues();

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.queues") }]);
  }, [setBreadcrumbs, t]);

  const openSnippetsDialog = (queue: QueueRow) => {
    setQueueForSnippets(queue);
    setSnippetsDialogOpen(true);
  };

  const openDeleteDialog = (queue: QueueRow) => {
    setQueueToDelete(queue);
    setDeleteDialogOpen(true);
  };

  const openEditDialog = (queue: QueueRow) => {
    setQueueToEdit(queue);
    setEditName(queue.name);
    setEditDialogOpen(true);
  };

  const handleDeleteQueue = async () => {
    if (!queueToDelete || !orgId) return;
    setIsDeleting(true);
    try {
      await deleteQueue(queueToDelete.id, orgId);
      setDeleteDialogOpen(false);
      setQueueToDelete(null);
      mutateQueues();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditQueue = async () => {
    if (!queueToEdit || !orgId || editName.trim() === "") return;
    setIsEditing(true);
    try {
      await updateQueue(queueToEdit.id, { name: editName.trim() }, orgId);
      setEditDialogOpen(false);
      setQueueToEdit(null);
      mutateQueues();
    } finally {
      setIsEditing(false);
    }
  };

  const handleCreateQueue = async (name: string) => {
    try {
      await createQueue({ name }, orgId);
      mutateQueues();
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create queue:", error);
    }
  };

  const columns = useMemo(
    () => createColumns(openSnippetsDialog, openEditDialog, openDeleteDialog, t),
    [openSnippetsDialog, openEditDialog, openDeleteDialog, t]
  );

  if (isQueuesLoading) {
    return <InsetLoading title={t("pages.queues.title")} />;
  } else if (queuesError) {
    return (
      <InsetError title={t("pages.queues.title")} errorMessage={queuesError.message} />
    );
  }

  return (
    <TooltipProvider>
      <InsetLayout title={t("pages.queues.title")}>
        <div className="flex items-center justify-between mb-6 min-h-10">
          <div className="text-sm text-muted-foreground max-w-2xl">
            {t("pages.queues.description")}
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("pages.queues.createButton")}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={(queues as QueueRow[]) || []}
          emptyState={{
            title: t("pages.queues.emptyTitle"),
            description: t("pages.queues.emptyDescription"),
          }}
        />
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("pages.queues.createDialogTitle")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get("name") as string;
                await handleCreateQueue(name);
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="name">{t("pages.queues.queueName")}</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={t("pages.queues.queueNamePlaceholder")}
                  className="mt-2"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit">{t("pages.queues.createQueue")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {queueForSnippets && (
          <QueueSnippetsDialog
            isOpen={snippetsDialogOpen}
            onClose={() => setSnippetsDialogOpen(false)}
            queueName={queueForSnippets.name}
            queueId={queueForSnippets.id}
          />
        )}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("pages.queues.editDialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("pages.queues.editDialogDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="edit-queue-name">{t("common.name")}</Label>
              <Input
                id="edit-queue-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={isEditing}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleEditQueue}
                disabled={isEditing || editName.trim() === ""}
              >
                {isEditing ? <Spinner className="h-4 w-4 mr-2" /> : null}
                {t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("pages.queues.deleteTitle")}</DialogTitle>
              <DialogDescription>
                {t("pages.queues.deleteConfirm", {
                  name: queueToDelete?.name || t("pages.queues.untitled"),
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteQueue}
                disabled={isDeleting}
              >
                {isDeleting ? <Spinner className="h-4 w-4 mr-2" /> : null}
                {t("common.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </InsetLayout>
    </TooltipProvider>
  );
}
