import { useRef } from "react";

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
import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/utils";

export type DetachConfirmSource = "delete" | "undo" | "redo";

export interface DetachNodesConfirmDialogProps {
  readonly open: boolean;
  readonly source: DetachConfirmSource | null;
  readonly nodeCount: number;
  readonly dontAskAgain: boolean;
  readonly onDontAskAgainChange: (checked: boolean) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

const SOURCE_DESCRIPTION_KEY: Record<
  DetachConfirmSource,
  TranslationKey
> = {
  delete: "workflow.canvas.detachConfirm.delete",
  undo: "workflow.canvas.detachConfirm.undo",
  redo: "workflow.canvas.detachConfirm.redo",
};

export function DetachNodesConfirmDialog({
  open,
  source,
  nodeCount,
  dontAskAgain,
  onDontAskAgainChange,
  onOpenChange,
  onConfirm,
}: DetachNodesConfirmDialogProps) {
  const { t } = useTranslation();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const descriptionKey =
    source != null ? SOURCE_DESCRIPTION_KEY[source] : SOURCE_DESCRIPTION_KEY.delete;

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
            {t("workflow.canvas.detachConfirm.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(descriptionKey, { count: nodeCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2 py-1">
          <Checkbox
            id="detach-confirm-dont-ask"
            checked={dontAskAgain}
            onCheckedChange={(checked) =>
              onDontAskAgainChange(checked === true)
            }
          />
          <Label htmlFor="detach-confirm-dont-ask" className="text-sm font-normal">
            {t("workflow.canvas.detachConfirm.dontAskAgain")}
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            ref={confirmButtonRef}
            className={cn(buttonVariants({ variant: "destructive" }))}
            onClick={onConfirm}
          >
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
