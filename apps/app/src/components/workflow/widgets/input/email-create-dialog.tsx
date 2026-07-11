import { useState } from "react";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { createEmail } from "@/services/email-service";

import { EmailSetupInfo } from "./email-setup-info";

type Step = "name" | "setup";

interface EmailCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (emailId: string) => void;
}

export function EmailCreateDialog({
  isOpen,
  onClose,
  onCreated,
}: EmailCreateDialogProps) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAddress, setCreatedAddress] = useState<string | null>(null);

  const resetForm = () => {
    setStep("name");
    setName("");
    setError(null);
    setCreatedAddress(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!organization?.id) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await createEmail({ name }, organization.id);
      setCreatedAddress(response.address);
      setStep("setup");
      onCreated(response.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pages.emails.createDialog.createFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitle =
    step === "name"
      ? t("pages.emails.createDialog.stepNameTitle")
      : t("pages.emails.createDialog.stepSetupTitle");
  const stepDescription =
    step === "name"
      ? t("pages.emails.createDialog.stepNameDescription")
      : t("pages.emails.createDialog.stepSetupDescription");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[450px]">
        <div>
          <DialogTitle className="text-base font-semibold">
            {stepTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {stepDescription}
          </DialogDescription>
        </div>

        {step === "name" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email-name">
                {t("pages.emails.createDialog.nameLabel")}
              </Label>
              <Input
                id="email-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("pages.emails.createDialog.namePlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.emails.createDialog.nameHint")}
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || name.trim() === ""}
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-1" />
                    {t("pages.emails.createDialog.creating")}
                  </>
                ) : (
                  t("pages.emails.createDialog.create")
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "setup" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-md font-medium">
                {t("pages.emails.createDialog.createdBadge")}
              </span>
              <span className="font-medium">{name}</span>
            </div>

            {createdAddress && <EmailSetupInfo emailAddress={createdAddress} />}

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                {t("pages.emails.createDialog.done")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
