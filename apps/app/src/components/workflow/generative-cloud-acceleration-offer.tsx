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
import { cn } from "@/utils/utils";

interface GenerativeCloudAccelerationOfferProps {
  readonly offerVisible: boolean;
  readonly dialogOpen: boolean;
  readonly onDialogOpenChange: (open: boolean) => void;
  readonly onSingleAccelerate: () => void;
  readonly onAlwaysAccelerate: () => void;
  readonly className?: string;
}

export function GenerativeCloudAccelerationOffer({
  offerVisible,
  dialogOpen,
  onDialogOpenChange,
  onSingleAccelerate,
  onAlwaysAccelerate,
  className,
}: GenerativeCloudAccelerationOfferProps) {
  const { t } = useTranslation();

  if (!offerVisible && !dialogOpen) {
    return null;
  }

  return (
    <>
      {offerVisible ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 shrink-0", className)}
          onClick={() => onDialogOpenChange(true)}
        >
          {t("workflow.cloudAcceleration.button")}
        </Button>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workflow.cloudAcceleration.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("workflow.cloudAcceleration.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button type="button" onClick={onSingleAccelerate}>
              {t("workflow.cloudAcceleration.single")}
            </Button>
            <Button type="button" variant="secondary" onClick={onAlwaysAccelerate}>
              {t("workflow.cloudAcceleration.alwaysForInterface")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDialogOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
