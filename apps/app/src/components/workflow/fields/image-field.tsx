import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import { FieldPlaceholder } from "./field-placeholder";
import {
  FileUploadZone,
  getObjectUrl,
  useFileUpload,
} from "./file-field-primitives";
import { createFileValidators } from "./file-upload-handler";
import type { FieldProps, ObjectReference } from "./types";

export interface ImageFieldProps extends FieldProps {
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

export function ImageField({
  className,
  connected,
  createObjectUrl,
  disabled,
  onChange,
  parameter,
  value,
}: ImageFieldProps) {
  const { t } = useTranslation();
  const fileValidators = createFileValidators(t);
  const { isUploading, uploadError, handleUpload } = useFileUpload(
    {
      validateFile: fileValidators.image,
      errorMessage: t("workflow.fields.uploadFailedImage"),
    },
    onChange
  );
  const objectUrl = getObjectUrl(value, createObjectUrl);
  const hasValue = objectUrl !== null;

  if (disabled && !hasValue) {
    return (
      <FieldPlaceholder
        className={className}
        connected={connected}
        label={t("workflow.fields.noImage")}
      />
    );
  }

  if (hasValue) {
    return (
      <div
        className={cn(
          "relative rounded-md overflow-hidden bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700",
          className
        )}
      >
        <img
          src={objectUrl}
          alt="Uploaded image"
          className="w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {uploadError && (
          <p className="absolute bottom-1 left-1 text-xs text-red-600 dark:text-red-400 bg-white/80 dark:bg-neutral-900/80 rounded px-1">
            {uploadError}
          </p>
        )}
      </div>
    );
  }

  return (
    <FileUploadZone
      className={className}
      accept="image/*"
      disabled={disabled}
      isUploading={isUploading}
      uploadError={uploadError}
      onFileUpload={handleUpload}
      parameterId={parameter.id}
      fieldType="image"
    />
  );
}
