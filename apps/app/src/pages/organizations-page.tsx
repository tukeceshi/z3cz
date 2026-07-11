import type { ColumnDef } from "@tanstack/react-table";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import PlusCircle from "lucide-react/icons/plus-circle";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppToast } from "@/hooks/use-app-toast";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import type { TranslateFn } from "@/i18n";
import {
  createOrganization,
  deleteOrganization,
  useMemberships,
  useOrganizations,
} from "@/services/organizations-service";
import { formatDate } from "@/utils/date";

function ActionsCell({
  organizationId,
  organizationName,
  t,
}: {
  organizationId: string;
  organizationName: string;
  t: TranslateFn;
}) {
  const { user } = useAuth();
  const { memberships } = useMemberships(organizationId);

  const isOwner = memberships.some(
    (m) => m.userId === user?.sub && m.role === "owner"
  );

  if (!isOwner) {
    return null;
  }

  return (
    <div className="text-right">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-haspopup="true" size="icon" variant="ghost">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">{t("common.openMenu")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent("deleteOrganizationTrigger", {
                  detail: {
                    id: organizationId,
                    name: organizationName,
                  },
                })
              )
            }
            className="text-red-600 focus:text-red-600"
          >
            {t("pages.organizations.deleteOrganization")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const createColumns = (t: TranslateFn): ColumnDef<{
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}>[] => [
  {
    accessorKey: "name",
    header: t("common.name"),
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "id",
    header: t("pages.organizations.id"),
    cell: ({ row }) => <div>{row.getValue("id")}</div>,
  },
  {
    accessorKey: "createdAt",
    header: t("pages.organizations.created"),
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date;
      return <div>{formatDate(date)}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <ActionsCell
        organizationId={row.original.id}
        organizationName={row.original.name}
        t={t}
      />
    ),
  },
];

export function OrganizationsPage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const {
    organizations,
    organizationsError,
    isOrganizationsLoading,
    mutateOrganizations,
  } = useOrganizations();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [orgToDelete, setOrgToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const navigate = useNavigate();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const columns = useMemo(() => createColumns(t), [t]);

  const handleCreateOrganization = useCallback(async (): Promise<void> => {
    if (!newOrgName.trim()) {
      appToast.error("pages.organizations.nameRequired");
      return;
    }
    setIsProcessing(true);
    try {
      const response = await createOrganization({
        name: newOrgName.trim(),
      });
      const newOrg = response.organization;
      navigate(`/org/${newOrg.id}/workflows`);
      appToast.success("pages.organizations.createdToast");
      setIsCreateDialogOpen(false);
      setNewOrgName("");
      await mutateOrganizations();
    } catch (error) {
      appToast.error("pages.organizations.createFailed");
      console.error("Create Organization Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [newOrgName, mutateOrganizations, navigate, appToast]);

  const handleDeleteOrganization = useCallback(async (): Promise<void> => {
    if (!orgToDelete) return;
    setIsProcessing(true);
    try {
      await deleteOrganization(orgToDelete.id);
      appToast.success("pages.organizations.deletedToast");
      setIsDeleteDialogOpen(false);
      setOrgToDelete(null);
      await mutateOrganizations();
    } catch (error) {
      appToast.error("pages.organizations.deleteFailed");
      console.error("Delete Organization Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [orgToDelete, mutateOrganizations, appToast]);

  const handleDeleteEvent = useCallback((e: Event) => {
    const custom = e as CustomEvent<{ id: string; name: string }>;
    if (custom.detail) {
      setOrgToDelete(custom.detail);
      setIsDeleteDialogOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("deleteOrganizationTrigger", handleDeleteEvent);
    return () =>
      document.removeEventListener(
        "deleteOrganizationTrigger",
        handleDeleteEvent
      );
  }, [handleDeleteEvent]);

  useEffect(() => {
    setBreadcrumbs([{ label: t("userMenu.organizations") }]);
  }, [setBreadcrumbs, t]);

  if (isOrganizationsLoading && !organizations) {
    return <InsetLoading title={t("pages.organizations.title")} />;
  } else if (organizationsError) {
    return (
      <InsetError
        title={t("pages.organizations.title")}
        errorMessage={organizationsError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("pages.organizations.title")}>
      <div className="flex items-center justify-between mb-6 min-h-10">
        <div className="text-sm text-muted-foreground max-w-2xl">
          {t("pages.organizations.description")}
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("pages.organizations.createButton")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={organizations || []}
        emptyState={{
          title: t("pages.organizations.emptyTitle"),
          description: t("pages.organizations.emptyDescription"),
        }}
      />

      <AlertDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pages.organizations.createDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.organizations.createDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">
                {t("pages.organizations.organizationName")}
              </Label>
              <Input
                id="org-name"
                placeholder={t("pages.organizations.organizationNamePlaceholder")}
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                disabled={isProcessing}
                maxLength={64}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setNewOrgName("");
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateOrganization}
              disabled={isProcessing || !newOrgName.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {isProcessing
                ? t("common.loading")
                : t("pages.organizations.createOrganization")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pages.organizations.deleteOrganization")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.organizations.deleteDescription", {
                name: orgToDelete?.name ?? "",
              })}
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{t("pages.organizations.deleteItems.workflows")}</li>
                <li>{t("pages.organizations.deleteItems.executions")}</li>
                <li>{t("pages.organizations.deleteItems.keys")}</li>
                <li>{t("pages.organizations.deleteItems.datasets")}</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {t("pages.organizations.deleteWarning")}
            </AlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOrgToDelete(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrganization}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing
                ? t("common.loading")
                : t("pages.organizations.deleteOrganization")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InsetLayout>
  );
}
