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
import { useTranslation } from "@/components/locale-provider";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/utils";

export interface DeleteSelectionConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly onConfirm: () => void;
}

export function DeleteSelectionConfirmDialog({
  open,
  onOpenChange,
  nodeCount,
  edgeCount,
  onConfirm,
}: DeleteSelectionConfirmDialogProps) {
  const { t } = useTranslation();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const description =
    nodeCount > 0 && edgeCount > 0
      ? t("workflow.canvas.deleteConfirmNodesAndEdges", {
          nodeCount,
          edgeCount,
        })
      : nodeCount > 0
        ? t("workflow.canvas.deleteConfirmNodes", { count: nodeCount })
        : t("workflow.canvas.deleteConfirmEdges", { count: edgeCount });

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
          <AlertDialogTitle>{t("workflow.canvas.deleteConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
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
