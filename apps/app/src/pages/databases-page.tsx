import { IDENTIFIER_PATTERN } from "@dafthunk/types";
import { ColumnDef } from "@tanstack/react-table";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import PlusCircle from "lucide-react/icons/plus-circle";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { useAuth } from "@/components/auth-context";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useOwnerPageGuard } from "@/hooks/use-owner-page-guard";
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
  createDatabase,
  deleteDatabase,
  useDatabases,
} from "@/services/database-service";
import { cn } from "@/utils/utils";

function useDatabaseActions() {
  const { t } = useTranslation();
  const { mutateDatabases } = useDatabases();
  const { organization } = useAuth();
  const orgId = organization?.id || "";

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [databaseToDelete, setDatabaseToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteDatabase = async () => {
    if (!databaseToDelete || !orgId) return;
    setIsDeleting(true);
    try {
      await deleteDatabase(databaseToDelete.id, orgId);
      setDeleteDialogOpen(false);
      setDatabaseToDelete(null);
      mutateDatabases();
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteDialog = (
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pages.databases.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.databases.deleteConfirm", {
              name: databaseToDelete?.name || t("pages.databases.untitled"),
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
            onClick={handleDeleteDatabase}
            disabled={isDeleting}
          >
            {isDeleting ? <Spinner className="h-4 w-4 mr-2" /> : null}
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    deleteDialog,
    openDeleteDialog: (database: any) => {
      setDatabaseToDelete(database);
      setDeleteDialogOpen(true);
    },
  };
}

function createColumns(
  openDeleteDialog: (database: any) => void,
  orgId: string,
  t: TranslateFn
): ColumnDef<any>[] {
  return [
    {
      accessorKey: "name",
      header: t("common.name"),
      cell: ({ row }) => {
        const name = row.getValue("name") as string;
        return (
          <span className="font-medium">
            {name || t("pages.databases.untitled")}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const database = row.original;
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
                  <Link to={`/org/${orgId}/databases/${database.id}/explorer`}>
                    {t("pages.databases.openExplorer")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/org/${orgId}/databases/${database.id}/console`}>
                    {t("pages.databases.openConsole")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDeleteDialog(database)}>
                  {t("pages.databases.deleteDatabase")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}

export function DatabasesPage() {
  const ownerGuard = useOwnerPageGuard("sidebar.databases");
  if (ownerGuard.blocked) return ownerGuard.gate;
  return <DatabasesPageContent />;
}

function DatabasesPageContent() {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newDatabaseName, setNewDatabaseName] = useState("");
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { organization } = useAuth();
  const orgId = organization?.id || "";

  const { databases, databasesError, isDatabasesLoading, mutateDatabases } =
    useDatabases();

  const { deleteDialog, openDeleteDialog } = useDatabaseActions();

  const columns = useMemo(
    () => createColumns(openDeleteDialog, orgId, t),
    [openDeleteDialog, orgId, t]
  );

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.databases") }]);
  }, [setBreadcrumbs, t]);

  const handleCreateDatabase = async (name: string) => {
    if (!orgId) return;

    try {
      await createDatabase({ name }, orgId);
      mutateDatabases();
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create database:", error);
    }
  };

  if (isDatabasesLoading) {
    return <InsetLoading title={t("pages.databases.title")} />;
  } else if (databasesError) {
    return (
      <InsetError title={t("pages.databases.title")} errorMessage={databasesError.message} />
    );
  }

  return (
    <TooltipProvider>
      <InsetLayout title={t("pages.databases.title")}>
        <div className="flex items-center justify-between mb-6  min-h-10">
          <div className="text-sm text-muted-foreground max-w-2xl">
            {t("pages.databases.description")}
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("pages.databases.createButton")}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={databases || []}
          emptyState={{
            title: t("pages.databases.emptyTitle"),
            description: t("pages.databases.emptyDescription"),
          }}
        />
        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) setNewDatabaseName("");
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("pages.databases.createDialogTitle")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleCreateDatabase(newDatabaseName.trim());
                setNewDatabaseName("");
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="name">{t("pages.databases.databaseName")}</Label>
                <Input
                  id="name"
                  name="name"
                  value={newDatabaseName}
                  onChange={(e) => setNewDatabaseName(e.target.value)}
                  placeholder={t("pages.databases.databaseNamePlaceholder")}
                  className={cn(
                    "mt-2",
                    newDatabaseName.trim().length > 0 &&
                      !IDENTIFIER_PATTERN.test(newDatabaseName.trim()) &&
                      "border-destructive"
                  )}
                />
                {newDatabaseName.trim().length > 0 &&
                  !IDENTIFIER_PATTERN.test(newDatabaseName.trim()) && (
                    <p className="text-xs text-destructive mt-1">
                      {t("pages.databases.nameValidation")}
                    </p>
                  )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    newDatabaseName.trim().length === 0 ||
                    !IDENTIFIER_PATTERN.test(newDatabaseName.trim())
                  }
                >
                  {t("pages.databases.createDatabase")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {deleteDialog}
      </InsetLayout>
    </TooltipProvider>
  );
}
