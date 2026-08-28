import { useRef } from "react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface VideoTrimShortDurationConfirmDialogProps {
  readonly open: boolean;
  readonly dontAskAgain: boolean;
  readonly onDontAskAgainChange: (checked: boolean) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

export function VideoTrimShortDurationConfirmDialog({
  open,
  dontAskAgain,
  onDontAskAgainChange,
  onOpenChange,
  onConfirm,
}: VideoTrimShortDurationConfirmDialogProps) {
  const { t } = useTranslation();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          confirmButtonRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("workflow.videoTrim.shortDurationConfirm.title")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{t("workflow.videoTrim.shortDurationConfirm.seedanceReference")}</p>
              <p>{t("workflow.videoTrim.shortDurationConfirm.seedance25Edit")}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2 py-1">
          <Checkbox
            id="video-trim-short-duration-dont-ask"
            checked={dontAskAgain}
            onCheckedChange={(checked) =>
              onDontAskAgainChange(checked === true)
            }
          />
          <Label
            htmlFor="video-trim-short-duration-dont-ask"
            className="text-sm font-normal"
          >
            {t("workflow.videoTrim.shortDurationConfirm.dontAskAgain")}
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction ref={confirmButtonRef} onClick={onConfirm}>
            {t("workflow.videoTrim.shortDurationConfirm.continue")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
