import { Secret } from "@dafthunk/types";
import { ColumnDef } from "@tanstack/react-table";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import PlusCircle from "lucide-react/icons/plus-circle";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-context";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { ResourceFeatureBanner } from "@/components/resource-feature-banner";
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
import { Textarea } from "@/components/ui/textarea";
import { useAppToast } from "@/hooks/use-app-toast";
import type { TranslateFn } from "@/i18n";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  createSecret,
  deleteSecret,
  updateSecret,
  useSecrets,
} from "@/services/secrets-service";
import { formatDate } from "@/utils/date";

function createColumns(t: TranslateFn): ColumnDef<Secret>[] {
  return [
    {
      accessorKey: "name",
      header: t("common.name"),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("pages.secrets.created"),
      cell: ({ row }) => {
        const date = row.getValue("createdAt") as Date;
        return <div>{formatDate(date)}</div>;
      },
    },
    {
      accessorKey: "updatedAt",
      header: t("pages.secrets.updated"),
      cell: ({ row }) => {
        const date = row.getValue("updatedAt") as Date;
        return <div>{formatDate(date)}</div>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const secret = row.original;
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
                      new CustomEvent("editSecretTrigger", {
                        detail: secret,
                      })
                    )
                  }
                >
                  {t("pages.secrets.editSecret")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    document.dispatchEvent(
                      new CustomEvent("deleteSecretTrigger", {
                        detail: secret.id,
                      })
                    )
                  }
                >
                  {t("pages.secrets.deleteSecret")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}

export function SecretsPage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { secrets, secretsError, isSecretsLoading, mutateSecrets } =
    useSecrets();
  const { organization } = useAuth();

  const [secretToDelete, setSecretToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newSecretName, setNewSecretName] = useState("");
  const [newSecretValue, setNewSecretValue] = useState("");
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [editSecretName, setEditSecretName] = useState("");
  const [editSecretValue, setEditSecretValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const columns = useMemo(() => createColumns(t), [t]);

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.secrets") }]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    const handleDeleteEvent = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) {
        setSecretToDelete(custom.detail);
        setIsDeleteDialogOpen(true);
      }
    };

    const handleEditEvent = (e: Event) => {
      const custom = e as CustomEvent<Secret>;
      if (custom.detail) {
        setEditingSecret(custom.detail);
        setEditSecretName(custom.detail.name);
        setEditSecretValue("");
        setIsEditDialogOpen(true);
      }
    };

    document.addEventListener("deleteSecretTrigger", handleDeleteEvent);
    document.addEventListener("editSecretTrigger", handleEditEvent);

    return () => {
      document.removeEventListener("deleteSecretTrigger", handleDeleteEvent);
      document.removeEventListener("editSecretTrigger", handleEditEvent);
    };
  }, [organization?.id]);

  const handleDeleteSecret = useCallback(async (): Promise<void> => {
    if (!secretToDelete || !organization?.id) return;
    setIsProcessing(true);
    try {
      await deleteSecret(secretToDelete, organization.id);
      appToast.success("pages.secrets.deleteSuccess");
      await mutateSecrets();
    } catch (error) {
      appToast.error("pages.secrets.deleteFailed");
      console.error("Delete Secret Error:", error);
    } finally {
      setIsDeleteDialogOpen(false);
      setSecretToDelete(null);
      setIsProcessing(false);
    }
  }, [secretToDelete, organization?.id, mutateSecrets, appToast]);

  const handleCreateSecret = useCallback(async (): Promise<void> => {
    if (!newSecretName.trim() || !newSecretValue.trim() || !organization?.id) {
      appToast.error("pages.secrets.nameValueRequired");
      return;
    }
    setIsProcessing(true);
    try {
      await createSecret(
        newSecretName.trim(),
        newSecretValue.trim(),
        organization.id
      );
      setIsCreateDialogOpen(false);
      setNewSecretName("");
      setNewSecretValue("");
      appToast.success("pages.secrets.createSuccess");
      await mutateSecrets();
    } catch (error) {
      appToast.error("pages.secrets.createFailed");
      console.error("Create Secret Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [newSecretName, newSecretValue, organization?.id, mutateSecrets, appToast]);

  const handleUpdateSecret = useCallback(async (): Promise<void> => {
    if (!editingSecret || !organization?.id) return;

    const updates: { name?: string; value?: string } = {};
    if (editSecretName.trim() !== editingSecret.name) {
      updates.name = editSecretName.trim();
    }
    if (editSecretValue.trim()) {
      updates.value = editSecretValue.trim();
    }

    if (Object.keys(updates).length === 0) {
      appToast.error("pages.secrets.noChanges");
      return;
    }

    setIsProcessing(true);
    try {
      await updateSecret(editingSecret.id, updates, organization.id);
      setIsEditDialogOpen(false);
      setEditingSecret(null);
      setEditSecretName("");
      setEditSecretValue("");
      appToast.success("pages.secrets.updateSuccess");
      await mutateSecrets();
    } catch (error) {
      appToast.error("pages.secrets.updateFailed");
      console.error("Update Secret Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [
    editingSecret,
    editSecretName,
    editSecretValue,
    organization?.id,
    mutateSecrets,
    appToast,
  ]);

  if (isSecretsLoading && !secrets) {
    return <InsetLoading title={t("pages.secrets.title")} />;
  } else if (secretsError) {
    return (
      <InsetError title={t("pages.secrets.title")} errorMessage={secretsError.message} />
    );
  }

  return (
    <InsetLayout title={t("pages.secrets.title")}>
      <ResourceFeatureBanner />
      <div className="flex items-center justify-between mb-6 min-h-10">
        <div className="text-sm text-muted-foreground max-w-2xl">
          {t("pages.secrets.description")}
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("pages.secrets.createButton")}
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={secrets || []}
        emptyState={{
          title: t("pages.secrets.emptyTitle"),
          description: t("pages.secrets.emptyDescription"),
        }}
      />

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.secrets.createDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("pages.secrets.createDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="secret-name">{t("common.name")}</Label>
              <Input
                id="secret-name"
                placeholder={t("pages.secrets.namePlaceholder")}
                value={newSecretName}
                onChange={(e) => setNewSecretName(e.target.value)}
                disabled={isProcessing}
                maxLength={64}
              />
            </div>
            <div>
              <Label htmlFor="secret-value">
                {t("pages.secrets.valuePlaceholder")}
              </Label>
              <Textarea
                id="secret-value"
                placeholder={t("pages.secrets.valuePlaceholder")}
                value={newSecretValue}
                onChange={(e) => setNewSecretValue(e.target.value)}
                disabled={isProcessing}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewSecretName("");
                setNewSecretValue("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreateSecret}
              disabled={
                isProcessing || !newSecretName.trim() || !newSecretValue.trim()
              }
            >
              {isProcessing
                ? t("pages.secrets.creating")
                : t("pages.secrets.createSecret")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.secrets.editDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("pages.secrets.editDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-secret-name">{t("common.name")}</Label>
              <Input
                id="edit-secret-name"
                placeholder={t("pages.secrets.namePlaceholder")}
                value={editSecretName}
                onChange={(e) => setEditSecretName(e.target.value)}
                disabled={isProcessing}
                maxLength={64}
              />
            </div>
            <div>
              <Label htmlFor="edit-secret-value">
                {t("pages.secrets.valueKeepHint")}
              </Label>
              <Textarea
                id="edit-secret-value"
                placeholder={t("pages.secrets.newValuePlaceholder")}
                value={editSecretValue}
                onChange={(e) => setEditSecretValue(e.target.value)}
                disabled={isProcessing}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingSecret(null);
                setEditSecretName("");
                setEditSecretValue("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleUpdateSecret} disabled={isProcessing}>
              {isProcessing
                ? t("pages.secrets.updating")
                : t("pages.secrets.updateSecret")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.secrets.deleteSecret")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.secrets.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSecretToDelete(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSecret}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? <Spinner className="h-4 w-4 mr-2" /> : null}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InsetLayout>
  );
}
