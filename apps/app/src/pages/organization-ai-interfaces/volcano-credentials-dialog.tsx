import ExternalLink from "lucide-react/icons/external-link";
import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppToast } from "@/hooks/use-app-toast";
import { updateOrganizationAiInterface } from "@/services/organization-ai-interface-service";

import { VolcanoCredentialFields } from "./volcano-credential-fields";

const IAM_KEY_URL = "https://console.volcengine.com/iam/keymanage";

interface VolcanoCredentialsDialogProps {
  open: boolean;
  organizationId: string;
  interfaceId: string;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<void>;
}

export function VolcanoCredentialsDialog({
  open,
  organizationId,
  interfaceId,
  onOpenChange,
  onUpdated,
}: VolcanoCredentialsDialogProps) {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setAccessKeyId("");
      setSecretAccessKey("");
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    if (!accessKeyId.trim() || !secretAccessKey.trim()) {
      appToast.error("pages.aiInterfaces.volcano.credentialsRequired");
      return;
    }

    setIsSaving(true);
    try {
      await updateOrganizationAiInterface(organizationId, interfaceId, {
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
      });
      await onUpdated();
      appToast.success("pages.aiInterfaces.volcano.credentialsUpdated");
      handleOpenChange(false);
    } catch (error) {
      appToast.errorRaw(
        error instanceof Error
          ? error.message
          : t("pages.aiInterfaces.volcano.credentialsUpdateFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("pages.aiInterfaces.volcano.credentialsDialogTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {t("pages.aiInterfaces.volcano.credentialsDialogDescription")}
          </p>
          <VolcanoCredentialFields
            idPrefix="volcano-credentials"
            accessKeyId={accessKeyId}
            secretAccessKey={secretAccessKey}
            onAccessKeyIdChange={setAccessKeyId}
            onSecretAccessKeyChange={setSecretAccessKey}
          />
          <a
            href={IAM_KEY_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            {t("pages.aiInterfaces.volcano.openIamConsole")}
            <ExternalLink className="size-3.5" />
          </a>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSaving}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {t("pages.aiInterfaces.volcano.credentialsSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
