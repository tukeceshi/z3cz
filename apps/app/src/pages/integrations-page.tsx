import PlusCircle from "lucide-react/icons/plus-circle";
import { useEffect, useState } from "react";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
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
import { usePageBreadcrumbs } from "@/hooks/use-page";
import { ResourceFeatureBanner } from "@/components/resource-feature-banner";
import {
  IntegrationDialog,
  IntegrationList,
  useIntegrationActions,
  useIntegrations,
  useOAuthCallback,
} from "@/integrations";

export function IntegrationsPage() {
  const { t } = useTranslation();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { integrations, error, isLoading, mutate } = useIntegrations();
  const { isProcessing, deleteIntegration } = useIntegrationActions();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<string | null>(
    null
  );

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.integrations") }]);
  }, [setBreadcrumbs, t]);

  useOAuthCallback({
    onSuccess: () => mutate(),
  });

  const handleDeleteClick = (integrationId: string) => {
    setIntegrationToDelete(integrationId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!integrationToDelete) return;

    try {
      await deleteIntegration(integrationToDelete);
      setIsDeleteDialogOpen(false);
      setIntegrationToDelete(null);
    } catch {
      // Error is already handled in the hook
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setIntegrationToDelete(null);
  };

  if (isLoading && !integrations) {
    return <InsetLoading title={t("pages.integrations.title")} />;
  }

  if (error) {
    return (
      <InsetError title={t("pages.integrations.title")} errorMessage={error.message} />
    );
  }

  return (
    <InsetLayout title={t("pages.integrations.title")}>
      <ResourceFeatureBanner />
      <div className="flex items-center justify-between mb-6 min-h-10">
        <div className="text-sm text-muted-foreground max-w-2xl">
          {t("pages.integrations.description")}
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("pages.integrations.addButton")}
        </Button>
      </div>

      <IntegrationList
        integrations={integrations || []}
        onDelete={handleDeleteClick}
      />

      <IntegrationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.integrations.disconnectTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.integrations.disconnectDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing
                ? t("pages.integrations.disconnecting")
                : t("pages.integrations.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InsetLayout>
  );
}
