import { VOLCANO_TEMPLATE_ID, type OrganizationAiInterface } from "@dafthunk/types";

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
import { useAppToast } from "@/hooks/use-app-toast";
import { deleteOrganizationAiInterface } from "@/services/organization-ai-interface-service";

interface DeleteAiInterfaceDialogProps {
  readonly organizationId: string;
  readonly iface: OrganizationAiInterface | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDeleted: () => Promise<void>;
}

export function DeleteAiInterfaceDialog({
  organizationId,
  iface,
  open,
  onOpenChange,
  onDeleted,
}: DeleteAiInterfaceDialogProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();

  const handleDelete = async () => {
    if (!iface) return;

    try {
      await deleteOrganizationAiInterface(organizationId, iface.id);
      appToast.success("pages.aiInterfaces.deleted");
      onOpenChange(false);
      await onDeleted();
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("pages.aiInterfaces.deleteFailed")
      );
    }
  };

  const isVolcano = iface?.templateId === VOLCANO_TEMPLATE_ID;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("pages.aiInterfaces.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                {t("pages.aiInterfaces.deleteConfirm", {
                  name: iface?.name ?? "",
                })}
              </p>
              {isVolcano ? (
                <p>{t("pages.aiInterfaces.deleteVolcanoHint")}</p>
              ) : null}
              {iface?.isDefault ? (
                <p>{t("pages.aiInterfaces.deleteDefaultHint")}</p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void handleDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("pages.aiInterfaces.deleteButton")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
