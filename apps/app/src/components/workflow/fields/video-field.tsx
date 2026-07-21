import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

import { WorkflowMediaVideoPlayer } from "../workflow-media-video-player";
import { FieldPlaceholder } from "./field-placeholder";
import {
  FileUploadZone,
  getObjectUrl,
  useFileUpload,
} from "./file-field-primitives";
import { createFileValidators } from "./file-upload-handler";
import type { FieldProps, ObjectReference } from "./types";

export interface VideoFieldProps extends FieldProps {
  createObjectUrl?: (objectReference: ObjectReference) => string;
}

export function VideoField({
  className,
  connected,
  createObjectUrl,
  disabled,
  onChange,
  parameter,
  value,
}: VideoFieldProps) {
  const { t } = useTranslation();
  const fileValidators = createFileValidators(t);
  const { isUploading, uploadError, handleUpload } = useFileUpload(
    {
      validateFile: fileValidators.video,
      errorMessage: t("workflow.fields.uploadFailedVideo"),
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
        label={t("workflow.fields.noVideo")}
      />
    );
  }

  if (hasValue) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-md border border-neutral-300 bg-neutral-950 dark:border-neutral-700",
          className
        )}
      >
        <WorkflowMediaVideoPlayer
          src={objectUrl}
          variant="field"
          objectFit="contain"
          className="min-h-[160px]"
        />
        {uploadError && (
          <p className="px-2 pb-2 text-xs text-red-600 dark:text-red-400">
            {uploadError}
          </p>
        )}
      </div>
    );
  }

  return (
    <FileUploadZone
      className={className}
      accept="video/*"
      disabled={disabled}
      isUploading={isUploading}
      uploadError={uploadError}
      onFileUpload={handleUpload}
      parameterId={parameter.id}
      fieldType="video"
    />
  );
}
