import { useTranslation } from "@/components/locale-provider";
import { isObjectReference } from "@/services/object-service";
import { cn } from "@/utils/utils";

import { FieldPlaceholder } from "./field-placeholder";
import {
  FileUploadZone,
  getObjectUrl,
  useFileUpload,
} from "./file-field-primitives";
import { createFileValidators } from "./file-upload-handler";
import type { FieldProps, ObjectReference } from "./types";

export interface AudioFieldProps extends FieldProps {
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

export function AudioField({
  className,
  connected,
  createObjectUrl,
  disabled,
  onChange,
  parameter,
  value,
}: AudioFieldProps) {
  const { t } = useTranslation();
  const fileValidators = createFileValidators(t);
  const { isUploading, uploadError, handleUpload } = useFileUpload(
    {
      validateFile: fileValidators.audio,
      errorMessage: t("workflow.fields.uploadFailedAudio"),
    },
    onChange
  );
  const objectUrl = getObjectUrl(value, createObjectUrl);
  const hasValue = objectUrl !== null;
  const mimeType =
    value && isObjectReference(value)
      ? (value as ObjectReference)?.mimeType || "audio/*"
      : "audio/*";

  if (disabled && !hasValue) {
    return (
      <FieldPlaceholder
        className={className}
        connected={connected}
        label={t("workflow.fields.noAudio")}
      />
    );
  }

  if (hasValue) {
    return (
      <div
        className={cn(
          "relative rounded-md p-2 bg-background border border-neutral-300 dark:border-neutral-700",
          className
        )}
      >
        <audio controls className="w-full text-xs" preload="metadata">
          <source src={objectUrl} type={mimeType} />
        </audio>
        {uploadError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {uploadError}
          </p>
        )}
      </div>
    );
  }

  return (
    <FileUploadZone
      className={className}
      accept="audio/*"
      disabled={disabled}
      isUploading={isUploading}
      uploadError={uploadError}
      onFileUpload={handleUpload}
      parameterId={parameter.id}
      fieldType="audio"
    />
  );
}
