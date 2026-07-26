import { useCallback, useState, type MouseEvent, type RefObject } from "react";

import { useTranslation } from "@/components/locale-provider";
import { useAppToast } from "@/hooks/use-app-toast";
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
  readonly blocksGenerativeMedia?: boolean;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onClearPrompt: () => void;
  readonly i18nPrefix:
    | "workflow.aiImagePanel"
    | "workflow.aiVideoPanel"
    | "workflow.aiAudioPanel";
}

export function useGenerativeCardDoubleClickUpload({
  prompt,
  hasMedia,
  isGenerating,
  disabled = false,
  uploading = false,
  blocksGenerativeMedia = false,
  fileInputRef,
  onClearPrompt,
  i18nPrefix,
}: UseGenerativeCardDoubleClickUploadParams) {
  const { t } = useTranslation();
  const toast = useAppToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canUpload = canGenerativeCardDoubleClickUpload({
    hasMedia,
    isGenerating,
    disabled: disabled || blocksGenerativeMedia,
    uploading,
  });

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  const handleCardDoubleClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();

      if (blocksGenerativeMedia) {
        toast.error(`${i18nPrefix}.cardUploadBlockedCloud`);
        return;
      }

      if (hasMedia && !isGenerating && !disabled && !uploading) {
        toast.error(`${i18nPrefix}.cardUploadReplaceNotAllowed`);
        return;
      }

      if (!canUpload) {
        return;
      }

      if (hasGenerativePrompt(prompt)) {
        setConfirmOpen(true);
        return;
      }
      openFilePicker();
    },
    [
      blocksGenerativeMedia,
      canUpload,
      disabled,
      hasMedia,
      i18nPrefix,
      isGenerating,
      openFilePicker,
      prompt,
      toast,
      uploading,
    ]
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
