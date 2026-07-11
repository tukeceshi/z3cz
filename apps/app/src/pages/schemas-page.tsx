import type { Field, SchemaEntity } from "@dafthunk/types";
import { ColumnDef } from "@tanstack/react-table";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import PlusCircle from "lucide-react/icons/plus-circle";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-context";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { SchemaDialog } from "@/components/schema-dialog";
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
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import type { TranslateFn } from "@/i18n";
import {
  createSchema,
  deleteSchema,
  updateSchema,
  useSchemas,
} from "@/services/schema-service";

function useSchemaActions() {
  const { t } = useTranslation();
  const { mutateSchemas } = useSchemas();
  const { organization } = useAuth();
  const orgId = organization?.id || "";

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [schemaToDelete, setSchemaToDelete] = useState<SchemaEntity | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!schemaToDelete || !orgId) return;
    setIsDeleting(true);
    try {
      await deleteSchema(schemaToDelete.id, orgId);
      setDeleteDialogOpen(false);
      setSchemaToDelete(null);
      mutateSchemas();
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteDialog = (
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pages.schemas.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.schemas.deleteConfirm", {
              name: schemaToDelete?.name ?? "",
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
            onClick={handleDelete}
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
    openDeleteDialog: (schema: SchemaEntity) => {
      setSchemaToDelete(schema);
      setDeleteDialogOpen(true);
    },
  };
}

function createColumns(
  openDeleteDialog: (schema: SchemaEntity) => void,
  openEditDialog: (schema: SchemaEntity) => void,
  t: TranslateFn
): ColumnDef<SchemaEntity>[] {
  return [
    {
      accessorKey: "name",
      header: t("common.name"),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("name")}</span>
      ),
    },
    {
      accessorKey: "description",
      header: t("pages.schemas.columns.description"),
      cell: ({ row }) => (
        <span className="text-muted-foreground truncate max-w-xs block">
          {row.getValue("description") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "fields",
      header: t("pages.schemas.columns.fields"),
      cell: ({ row }) => {
        const fields = row.getValue("fields") as Field[];
        return <span className="text-muted-foreground">{fields.length}</span>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const schema = row.original;
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
                <DropdownMenuItem onClick={() => openEditDialog(schema)}>
                  {t("pages.schemas.editSchema")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDeleteDialog(schema)}>
                  {t("pages.schemas.deleteSchema")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}

export function SchemasPage() {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editSchema, setEditSchema] = useState<SchemaEntity | null>(null);
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { organization } = useAuth();
  const orgId = organization?.id || "";

  const { schemas, schemasError, isSchemasLoading, mutateSchemas } =
    useSchemas();

  const { deleteDialog, openDeleteDialog } = useSchemaActions();

  const columns = createColumns(openDeleteDialog, (schema) =>
    setEditSchema(schema), t
  );

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.schemas") }]);
  }, [setBreadcrumbs, t]);

  const handleCreate = async (data: {
    name: string;
    description: string;
    fields: Field[];
  }) => {
    if (!orgId) return;
    await createSchema(data, orgId);
    mutateSchemas();
  };

  const handleEdit = async (data: {
    name: string;
    description: string;
    fields: Field[];
  }) => {
    if (!orgId || !editSchema) return;
    await updateSchema(editSchema.id, data, orgId);
    mutateSchemas();
  };

  if (isSchemasLoading) {
    return <InsetLoading title={t("pages.schemas.title")} />;
  } else if (schemasError) {
    return (
      <InsetError
        title={t("pages.schemas.title")}
        errorMessage={schemasError.message}
      />
    );
  }

  return (
    <TooltipProvider>
      <InsetLayout title={t("pages.schemas.title")}>
        <div className="flex items-center justify-between mb-6 min-h-10">
          <div className="text-sm text-muted-foreground max-w-2xl">
            {t("pages.schemas.description")}
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("pages.schemas.createButton")}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={schemas || []}
          emptyState={{
            title: t("pages.schemas.emptyTitle"),
            description: t("pages.schemas.emptyDescription"),
          }}
        />
        <SchemaDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          schemas={schemas}
          onSubmit={handleCreate}
          title={t("pages.schemas.createDialogTitle")}
          submitLabel={t("pages.schemas.createSchema")}
        />
        <SchemaDialog
          open={editSchema !== null}
          onOpenChange={(open) => {
            if (!open) setEditSchema(null);
          }}
          schema={editSchema}
          schemas={schemas}
          onSubmit={handleEdit}
          title={t("pages.schemas.editDialogTitle")}
          submitLabel={t("pages.schemas.saveChanges")}
        />
        {deleteDialog}
      </InsetLayout>
    </TooltipProvider>
  );
}
