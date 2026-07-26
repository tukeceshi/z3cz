import { Link } from "react-router";

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
import { useOrgUrl } from "@/hooks/use-org-url";

interface ChangeCoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cloudStorageConfigured: boolean;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onClear?: () => void;
  hasCover: boolean;
}

export function ChangeCoverDialog({
  open,
  onOpenChange,
  cloudStorageConfigured,
  isUploading,
  onUpload,
  onClear,
  hasCover,
}: ChangeCoverDialogProps) {
  const { t } = useTranslation();
  const { getOrgUrl } = useOrgUrl();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      return;
    }
    onUpload(file);
    event.target.value = "";
  };

  if (!cloudStorageConfigured) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pages.workflows.cover.title")}</DialogTitle>
            <DialogDescription>
              {t("pages.workflows.cover.cloudStorageRequired")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button asChild>
              <Link to={getOrgUrl("ai-interfaces")}>
                {t("pages.workflows.cover.configureCloudStorage")}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pages.workflows.cover.title")}</DialogTitle>
          <DialogDescription>
            {t("pages.workflows.cover.uploadHint")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Button variant="outline" disabled={isUploading} asChild>
            <label className="cursor-pointer">
              {isUploading
                ? t("pages.workflows.cover.uploading")
                : t("pages.workflows.cover.chooseImage")}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={isUploading}
                onChange={handleFileChange}
              />
            </label>
          </Button>
          {hasCover && onClear ? (
            <Button
              variant="ghost"
              disabled={isUploading}
              onClick={onClear}
            >
              {t("pages.workflows.cover.remove")}
            </Button>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
