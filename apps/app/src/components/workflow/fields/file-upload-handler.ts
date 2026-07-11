import type React from "react";

import type { TranslateFn } from "@/i18n";

export interface FileUploadConfig {
  validateFile?: (file: File) => void;
  getMimeType?: (file: File) => string;
  errorMessage: string;
}

export function createFileUploadHandler(
  config: FileUploadConfig,
  uploadBinaryData: (
    arrayBuffer: ArrayBuffer,
    mimeType: string
  ) => Promise<unknown>,
  onChange: (value: unknown) => void,
  setIsUploading: (loading: boolean) => void,
  setUploadError: (error: string | null) => void
) {
  return async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadError(null);
      setIsUploading(true);

      if (config.validateFile) {
        config.validateFile(file);
      }

      const mimeType = config.getMimeType
        ? config.getMimeType(file)
        : file.type;

      const arrayBuffer = await file.arrayBuffer();
      const reference = await uploadBinaryData(arrayBuffer, mimeType);
      onChange(reference);
      setIsUploading(false);
    } catch (err) {
      setIsUploading(false);
      setUploadError(err instanceof Error ? err.message : config.errorMessage);
    }
  };
}

export function createFileValidators(t: TranslateFn) {
  return {
    image: (file: File) => {
      if (!file.type.startsWith("image/")) {
        throw new Error(t("workflow.fields.invalidImageFile"));
      }
    },
    audio: (file: File) => {
      if (!file.type.startsWith("audio/")) {
        throw new Error(t("workflow.fields.invalidAudioFile"));
      }
    },
    video: (file: File) => {
      if (!file.type.startsWith("video/")) {
        throw new Error(t("workflow.fields.invalidVideoFile"));
      }
    },
    gltf: (file: File) => {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".gltf") && !fileName.endsWith(".glb")) {
        throw new Error(t("workflow.fields.invalidGltfFile"));
      }
    },
  };
}

export const mimeTypeDetectors = {
  document: (file: File): string => {
    if (file.name.endsWith(".xlsx")) {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    if (file.name.endsWith(".xls")) {
      return "application/vnd.ms-excel";
    }
    return file.type;
  },
  gltf: (file: File): string => {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".gltf")) {
      return "model/gltf+json";
    }
    if (fileName.endsWith(".glb")) {
      return "model/gltf-binary";
    }
    return file.type;
  },
};
