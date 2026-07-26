import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

interface RenameLibraryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  title: string;
  isSaving: boolean;
  onSave: (name: string) => void;
}

export function RenameLibraryItemDialog({
  open,
  onOpenChange,
  initialName,
  title,
  isSaving,
  onSave,
}: RenameLibraryItemDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) {
      setName(initialName);
    }
  }, [open, initialName]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    onSave(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("workflowScheme.workflowNamePlaceholder")}
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? <Spinner className="mr-2 h-4 w-4" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
