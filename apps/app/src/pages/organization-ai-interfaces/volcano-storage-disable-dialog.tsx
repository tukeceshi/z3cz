import { useState } from "react";

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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VolcanoStorageDisableDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
  readonly isSaving: boolean;
}

export function VolcanoStorageDisableDialog({
  open,
  onOpenChange,
  onConfirm,
  isSaving,
}: VolcanoStorageDisableDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [understood, setUnderstood] = useState(false);
  const [noRunningTasks, setNoRunningTasks] = useState(false);

  const handleClose = (next: boolean) => {
    if (!next) {
      setStep(1);
      setUnderstood(false);
      setNoRunningTasks(false);
    }
    onOpenChange(next);
  };

  if (step === 1) {
    return (
      <AlertDialog open={open} onOpenChange={handleClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("pages.aiInterfaces.tosStorage.disableTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.aiInterfaces.tosStorage.disableStep1")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => setStep(2)}>
              {t("common.continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pages.aiInterfaces.tosStorage.disableTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("pages.aiInterfaces.tosStorage.disableStep2")}
        </p>
        <div className="space-y-3 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
              className="mt-0.5"
            />
            <span>{t("pages.aiInterfaces.tosStorage.disableAckImpact")}</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={noRunningTasks}
              onChange={(event) => setNoRunningTasks(event.target.checked)}
              className="mt-0.5"
            />
            <span>{t("pages.aiInterfaces.tosStorage.disableAckNoTasks")}</span>
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setStep(1)}>
            {t("common.back")}
          </Button>
          <Button
            variant="destructive"
            disabled={!understood || !noRunningTasks || isSaving}
            onClick={onConfirm}
          >
            {isSaving ? t("common.saving") : t("pages.aiInterfaces.tosStorage.confirmDisable")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
