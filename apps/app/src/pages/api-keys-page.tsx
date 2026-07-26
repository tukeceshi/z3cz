import { ApiKey } from "@dafthunk/types";
import { ColumnDef } from "@tanstack/react-table";
import Copy from "lucide-react/icons/copy";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import PlusCircle from "lucide-react/icons/plus-circle";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-context";
import { OrgPermissionGate } from "@/components/org-permission-gate";
import { useTranslation } from "@/components/locale-provider";
import { useOrgPermissions } from "@/hooks/use-org-permissions";
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
import { useAppToast } from "@/hooks/use-app-toast";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import type { TranslateFn } from "@/i18n";
import {
  createApiKey,
  deleteApiKey,
  rollApiKey,
  useApiKeys,
} from "@/services/api-keys-service";
import { formatDate } from "@/utils/date";

const createColumns = (t: TranslateFn): ColumnDef<ApiKey>[] => [
  {
    accessorKey: "name",
    header: t("common.name"),
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: t("pages.apiKeys.created"),
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date;
      return <div>{formatDate(date)}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const apiKey = row.original;
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
                    new CustomEvent("rollApiTokenTrigger", {
                      detail: apiKey.id,
                    })
                  )
                }
              >
                {t("pages.apiKeys.rollKey")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  document.dispatchEvent(
                    new CustomEvent("deleteApiTokenTrigger", {
                      detail: apiKey.id,
                    })
                  )
                }
              >
                {t("pages.apiKeys.deleteKey")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export function ApiKeysPage() {
  const { t } = useTranslation();
  const perms = useOrgPermissions();

  if (!perms.canAccessApiKeys) {
    return (
      <OrgPermissionGate allowed={false} title={t("sidebar.apiKeys")}>
        {null}
      </OrgPermissionGate>
    );
  }

  return <ApiKeysPageContent />;
}

function ApiKeysPageContent() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { apiKeys, apiKeysError, isApiKeysLoading, mutateApiKeys } =
    useApiKeys();
  const { organization } = useAuth();

  const [tokenToDelete, setTokenToDelete] = useState<string | null>(null);
  const [tokenToRoll, setTokenToRoll] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRollDialogOpen, setIsRollDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdKeyToShow, setCreatedKeyToShow] = useState<string | null>(null);
  const [isShowKeyDialogOpen, setIsShowKeyDialogOpen] = useState(false);

  const columns = useMemo(() => createColumns(t), [t]);

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.apiKeys") }]);
  }, [setBreadcrumbs, t]);

  useEffect(() => {
    const handleDeleteEvent = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) {
        setTokenToDelete(custom.detail);
        setIsDeleteDialogOpen(true);
      }
    };
    const handleRollEvent = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) {
        setTokenToRoll(custom.detail);
        setIsRollDialogOpen(true);
      }
    };
    document.addEventListener("deleteApiTokenTrigger", handleDeleteEvent);
    document.addEventListener("rollApiTokenTrigger", handleRollEvent);
    return () => {
      document.removeEventListener("deleteApiTokenTrigger", handleDeleteEvent);
      document.removeEventListener("rollApiTokenTrigger", handleRollEvent);
    };
  }, []);

  const handleDeleteKey = useCallback(async (): Promise<void> => {
    if (!tokenToDelete || !organization?.id) return;
    setIsProcessing(true);
    try {
      await deleteApiKey(tokenToDelete, organization.id);
      appToast.success("pages.apiKeys.deletedToast");
      await mutateApiKeys();
    } catch (error) {
      appToast.error("pages.apiKeys.deleteFailed");
      console.error("Delete API Key Error:", error);
    } finally {
      setIsDeleteDialogOpen(false);
      setTokenToDelete(null);
      setIsProcessing(false);
    }
  }, [tokenToDelete, organization?.id, mutateApiKeys, appToast]);

  const handleRollKey = useCallback(async (): Promise<void> => {
    if (!tokenToRoll || !organization?.id) return;
    setIsProcessing(true);
    try {
      const rolledKey = await rollApiKey(tokenToRoll, organization.id);
      setCreatedKeyToShow(rolledKey.apiKey);
      setIsRollDialogOpen(false);
      setIsShowKeyDialogOpen(true);
      appToast.success("pages.apiKeys.rolledToast");
      await mutateApiKeys();
    } catch (error) {
      appToast.error("pages.apiKeys.rollFailed");
      console.error("Roll API Key Error:", error);
    } finally {
      setTokenToRoll(null);
      setIsProcessing(false);
    }
  }, [tokenToRoll, organization?.id, mutateApiKeys, appToast]);

  const handleCreateKey = useCallback(async (): Promise<void> => {
    if (!newKeyName.trim() || !organization?.id) {
      appToast.error("pages.apiKeys.nameRequired");
      return;
    }
    setIsProcessing(true);
    try {
      const newKey = await createApiKey(newKeyName.trim(), organization.id);
      setCreatedKeyToShow(newKey.apiKey);
      setIsCreateDialogOpen(false);
      setIsShowKeyDialogOpen(true);
      setNewKeyName("");
      appToast.success("pages.apiKeys.createdToast");
      await mutateApiKeys();
    } catch (error) {
      appToast.error("pages.apiKeys.createFailed");
      console.error("Create API Key Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [newKeyName, organization?.id, mutateApiKeys, appToast]);

  const handleShowKeyDialogClose = useCallback((open: boolean) => {
    setIsShowKeyDialogOpen(open);
    if (!open) {
      setCreatedKeyToShow(null);
    }
  }, []);

  const handleCopyKey = useCallback(async (): Promise<void> => {
    if (!createdKeyToShow) return;
    await navigator.clipboard.writeText(createdKeyToShow);
    appToast.success("pages.apiKeys.copiedToast");
  }, [createdKeyToShow, appToast]);

  if (isApiKeysLoading && !apiKeys) {
    return <InsetLoading title={t("pages.apiKeys.title")} />;
  } else if (apiKeysError) {
    return (
      <InsetError
        title={t("pages.apiKeys.title")}
        errorMessage={apiKeysError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("pages.apiKeys.title")}>
      <div className="flex items-center justify-between mb-6 min-h-10">
        <div className="text-sm text-muted-foreground max-w-2xl">
          {t("pages.apiKeys.description")}
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("pages.apiKeys.createButton")}
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={apiKeys || []}
        emptyState={{
          title: t("pages.apiKeys.emptyTitle"),
          description: t("pages.apiKeys.emptyDescription"),
        }}
      />
      <AlertDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.apiKeys.nameDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.apiKeys.nameDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoFocus
            placeholder={t("pages.apiKeys.keyNamePlaceholder")}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            disabled={isProcessing}
            maxLength={64}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewKeyName("")}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreateKey}
              disabled={isProcessing || !newKeyName.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {isProcessing ? t("common.loading") : t("common.create")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={isShowKeyDialogOpen}
        onOpenChange={handleShowKeyDialogClose}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.apiKeys.showDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.apiKeys.showDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {t("pages.apiKeys.showDialogWarning")}
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-2 bg-muted rounded px-3 py-2 font-mono text-sm select-all overflow-x-auto w-full">
            <span className="truncate whitespace-pre w-full block">
              {createdKeyToShow}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={handleCopyKey}
              className="ml-2"
            >
              <Copy className="w-4 h-4" />
              <span className="sr-only">{t("pages.apiKeys.copyKey")}</span>
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsShowKeyDialogOpen(false)}>
              {t("pages.apiKeys.done")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isRollDialogOpen} onOpenChange={setIsRollDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.apiKeys.rollDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.apiKeys.rollDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTokenToRoll(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollKey}
              disabled={isProcessing}
              className="bg-primary hover:bg-primary/90"
            >
              {isProcessing ? t("common.loading") : t("pages.apiKeys.rollKey")}
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
            <AlertDialogTitle>{t("pages.apiKeys.deleteKey")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.apiKeys.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTokenToDelete(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKey}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? t("common.loading") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InsetLayout>
  );
}
