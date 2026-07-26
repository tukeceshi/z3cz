import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

interface DeleteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  workflowCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function DeleteFolderDialog({
  open,
  onOpenChange,
  folderName,
  workflowCount,
  isDeleting,
  onConfirm,
}: DeleteFolderDialogProps) {
  const { t } = useTranslation();
  const [confirmName, setConfirmName] = useState("");

  const canDelete = confirmName === folderName && !isDeleting;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setConfirmName("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pages.workflows.folders.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.workflows.folders.deleteDescription", {
              name: folderName,
              count: workflowCount,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t("pages.workflows.folders.deleteTypeName")}
          </p>
          <Input
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            placeholder={folderName}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={!canDelete}
            onClick={onConfirm}
          >
            {isDeleting ? <Spinner className="mr-2 h-4 w-4" /> : null}
            {t("pages.workflows.folders.deleteConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
