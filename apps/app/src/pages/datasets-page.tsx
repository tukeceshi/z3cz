import { ColumnDef } from "@tanstack/react-table";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import PlusCircle from "lucide-react/icons/plus-circle";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "@/components/auth-context";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { ResourceFeatureBanner } from "@/components/resource-feature-banner";
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
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  createDataset,
  deleteDataset,
  useDatasets,
} from "@/services/dataset-service";

function useDatasetActions() {
  const { t } = useTranslation();
  const { mutateDatasets } = useDatasets();
  const { organization } = useAuth();
  const orgId = organization?.id || "";

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [datasetToDelete, setDatasetToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteDataset = async () => {
    if (!datasetToDelete || !orgId) return;
    setIsDeleting(true);
    try {
      await deleteDataset(datasetToDelete.id, orgId);
      setDeleteDialogOpen(false);
      setDatasetToDelete(null);
      mutateDatasets();
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteDialog = (
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pages.datasets.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.datasets.deleteConfirm", {
              name: datasetToDelete?.name || t("pages.datasets.untitled"),
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
            onClick={handleDeleteDataset}
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
    openDeleteDialog: (dataset: any) => {
      setDatasetToDelete(dataset);
      setDeleteDialogOpen(true);
    },
  };
}

function createColumns(
  openDeleteDialog: (dataset: any) => void,
  navigate: ReturnType<typeof useNavigate>,
  getOrgUrl: (path: string) => string,
  t: TranslateFn
): ColumnDef<any>[] {
  return [
    {
      accessorKey: "name",
      header: t("common.name"),
      cell: ({ row }) => {
        const name = row.getValue("name") as string;
        const datasetId = row.original.id;
        return (
          <Link
            to={getOrgUrl(`datasets/${datasetId}`)}
            className="hover:underline"
          >
            <div className="font-medium">
              {name || t("pages.datasets.untitled")}
            </div>
          </Link>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const dataset = row.original;
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
                <DropdownMenuItem
                  onClick={() => navigate(getOrgUrl(`datasets/${dataset.id}`))}
                >
                  {t("pages.datasets.viewDataset")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDeleteDialog(dataset)}>
                  {t("pages.datasets.deleteDataset")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}

export function DatasetsPage() {
  const ownerGuard = useOwnerPageGuard("sidebar.datasets");
  if (ownerGuard.blocked) return ownerGuard.gate;
  return <DatasetsPageContent />;
}

function DatasetsPageContent() {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { organization } = useAuth();
  const orgId = organization?.id || "";
  const { getOrgUrl } = useOrgUrl();

  const { datasets, datasetsError, isDatasetsLoading, mutateDatasets } =
    useDatasets();

  const { deleteDialog, openDeleteDialog } = useDatasetActions();

  const columns = useMemo(
    () => createColumns(openDeleteDialog, navigate, getOrgUrl, t),
    [openDeleteDialog, navigate, getOrgUrl, t]
  );

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.datasets") }]);
  }, [setBreadcrumbs, t]);

  const handleCreateDataset = async (name: string) => {
    if (!orgId) return;

    try {
      const newDataset = await createDataset({ name }, orgId);
      mutateDatasets();
      navigate(getOrgUrl(`datasets/${newDataset.id}`));
    } catch (error) {
      console.error("Failed to create dataset:", error);
    }
  };

  if (isDatasetsLoading) {
    return <InsetLoading title={t("pages.datasets.title")} />;
  } else if (datasetsError) {
    return (
      <InsetError title={t("pages.datasets.title")} errorMessage={datasetsError.message} />
    );
  }

  return (
    <TooltipProvider>
      <InsetLayout title={t("pages.datasets.title")}>
        <ResourceFeatureBanner />
        <div className="flex items-center justify-between mb-6  min-h-10">
          <div className="text-sm text-muted-foreground max-w-2xl">
            {t("pages.datasets.description")}
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("pages.datasets.createButton")}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={datasets || []}
          emptyState={{
            title: t("pages.datasets.emptyTitle"),
            description: t("pages.datasets.emptyDescription"),
          }}
        />
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("pages.datasets.createDialogTitle")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get("name") as string;
                await handleCreateDataset(name);
                setIsCreateDialogOpen(false);
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="name">{t("pages.datasets.datasetName")}</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={t("pages.datasets.datasetNamePlaceholder")}
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
                <Button type="submit">{t("pages.datasets.createDataset")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {deleteDialog}
      </InsetLayout>
    </TooltipProvider>
  );
}
