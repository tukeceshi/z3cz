import { useCallback, useState, type RefObject } from "react";

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
  hasGenerativePrompt,
  withGenerativePromptCleared,
} from "./generative-card-upload-utils";
import { readTextCardUploadFile } from "./read-text-card-upload-file";
import { canTextCardUpload, TEXT_CARD_UPLOAD_ACCEPT } from "./text-card-upload-utils";
import type { WorkflowNodeType } from "./workflow-types";

interface UseTextCardFileUploadParams {
  readonly nodeId: string;
  readonly prompt: string;
  readonly hasOutput: boolean;
  readonly isGenerating: boolean;
  readonly disabled?: boolean;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly updateNodeData?: (
    nodeId: string,
    updater: (current: WorkflowNodeType) => Partial<WorkflowNodeType>
  ) => void;
  readonly onApplyText: (text: string) => void;
}

export function useTextCardFileUpload({
  nodeId,
  prompt,
  hasOutput,
  isGenerating,
  disabled = false,
  fileInputRef,
  updateNodeData,
  onApplyText,
}: UseTextCardFileUploadParams) {
  const { t } = useTranslation();
  const toast = useAppToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canUpload = canTextCardUpload({
    hasOutput,
    isGenerating,
    disabled,
    uploading,
  });

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  const handleUploadClick = useCallback(() => {
    if (hasOutput && !isGenerating && !disabled && !uploading) {
      toast.error("workflow.aiTextPanel.cardUploadReplaceNotAllowed");
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
  }, [
    canUpload,
    disabled,
    hasOutput,
    isGenerating,
    openFilePicker,
    prompt,
    toast,
    uploading,
  ]);

  const handleConfirmUpload = useCallback(() => {
    if (updateNodeData) {
      updateNodeData(nodeId, (current) => ({
        inputs: withGenerativePromptCleared(current.inputs),
      }));
    }
    setConfirmOpen(false);
    openFilePicker();
  }, [nodeId, openFilePicker, updateNodeData]);

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file || disabled || uploading) {
        return;
      }

      if (hasOutput && !isGenerating) {
        toast.error("workflow.aiTextPanel.cardUploadReplaceNotAllowed");
        return;
      }

      setUploading(true);
      try {
        const result = await readTextCardUploadFile(file);
        if (!result.ok) {
          if (result.error === "legacy-doc") {
            toast.error("workflow.aiTextPanel.uploadUnsupportedDoc");
            return;
          }
          if (result.error === "text_too_long") {
            toast.error("workflow.aiTextPanel.uploadTextTooLong");
            return;
          }
          if (result.error === "empty_file") {
            toast.error("workflow.aiTextPanel.uploadEmptyFile");
            return;
          }
          if (result.error === "unsupported") {
            toast.error("workflow.aiTextPanel.uploadUnsupportedFile");
            return;
          }
          toast.error("workflow.aiTextPanel.uploadFailed");
          return;
        }

        if (hasGenerativePrompt(prompt) && updateNodeData) {
          updateNodeData(nodeId, (current) => ({
            inputs: withGenerativePromptCleared(current.inputs),
          }));
        }

        onApplyText(result.text);
      } finally {
        setUploading(false);
      }
    },
    [
      disabled,
      hasOutput,
      isGenerating,
      nodeId,
      onApplyText,
      prompt,
      toast,
      updateNodeData,
      uploading,
    ]
  );

  const uploadConfirmDialog = (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("workflow.aiTextPanel.cardUploadClearPromptTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("workflow.aiTextPanel.cardUploadClearPromptDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmUpload}>
            {t("workflow.aiTextPanel.cardUploadClearPromptConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={TEXT_CARD_UPLOAD_ACCEPT}
      className="hidden"
      onChange={(event) => {
        void handleUploadFiles(event.target.files);
        event.target.value = "";
      }}
    />
  );

  return {
    uploading,
    canUpload,
    handleUploadClick,
    uploadConfirmDialog,
    fileInput,
  };
}
