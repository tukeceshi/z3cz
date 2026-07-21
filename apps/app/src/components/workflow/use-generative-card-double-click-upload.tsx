import { useCallback, useState, type MouseEvent, type RefObject } from "react";

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

import {
  canGenerativeCardDoubleClickUpload,
  hasGenerativePrompt,
} from "./generative-card-upload-utils";

interface UseGenerativeCardDoubleClickUploadParams {
  readonly prompt: string;
  readonly hasMedia: boolean;
  readonly isGenerating: boolean;
  readonly disabled?: boolean;
  readonly uploading?: boolean;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onClearPrompt: () => void;
  readonly i18nPrefix: "workflow.aiImagePanel" | "workflow.aiVideoPanel";
}

export function useGenerativeCardDoubleClickUpload({
  prompt,
  hasMedia,
  isGenerating,
  disabled = false,
  uploading = false,
  fileInputRef,
  onClearPrompt,
  i18nPrefix,
}: UseGenerativeCardDoubleClickUploadParams) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canUpload = canGenerativeCardDoubleClickUpload({
    hasMedia,
    isGenerating,
    disabled,
    uploading,
  });

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  const handleCardDoubleClick = useCallback(
    (event: MouseEvent) => {
      if (!canUpload) {
        return;
      }
      event.stopPropagation();
      if (hasGenerativePrompt(prompt)) {
        setConfirmOpen(true);
        return;
      }
      openFilePicker();
    },
    [canUpload, openFilePicker, prompt]
  );

  const handleConfirmUpload = useCallback(() => {
    onClearPrompt();
    setConfirmOpen(false);
    openFilePicker();
  }, [onClearPrompt, openFilePicker]);

  const uploadConfirmDialog = (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(`${i18nPrefix}.cardUploadClearPromptTitle`)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(`${i18nPrefix}.cardUploadClearPromptDescription`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmUpload}>
            {t(`${i18nPrefix}.cardUploadClearPromptConfirm`)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    canUpload,
    handleCardDoubleClick,
    uploadConfirmDialog,
  };
}
