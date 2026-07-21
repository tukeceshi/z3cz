import {
  getMediaReferenceKey,
  isMediaReference,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import {
  resolveMediaFromValue,
  useMediaDisplayUrl,
} from "@/hooks/use-media-display-url";
import type { MediaDisplaySize } from "@/services/media-display-size";
import { cn } from "@/utils/utils";

export interface MediaImageFieldProps {
  readonly value: MediaReference | unknown;
  readonly createObjectUrl?: (ref: ObjectReference) => string;
  readonly className?: string;
  readonly size?: MediaDisplaySize;
  readonly imageClassName?: string;
}

export function MediaImageField({
  value,
  createObjectUrl,
  className,
  size = "full",
  imageClassName,
}: MediaImageFieldProps) {
  const { t } = useTranslation();
  const media = resolveMediaFromValue(value);
  const mediaKey = media ? getMediaReferenceKey(media) : null;
  const [useFullFallback, setUseFullFallback] = useState(false);
  const effectiveSize = size === "thumb" && useFullFallback ? "full" : size;
  const { displayUrl, stale } = useMediaDisplayUrl({
    media,
    createObjectUrl,
    nodeType: "ai-image",
    size: effectiveSize,
  });
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
    setUseFullFallback(false);
  }, [mediaKey, size]);

  useEffect(() => {
    setImgError(false);
  }, [displayUrl]);

  if (!media || !isMediaReference(media)) {
    return null;
  }

  if (stale || !displayUrl || imgError) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[72px] w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400",
          className
        )}
      >
        {t("workflow.aiMediaCache.imageUnavailable")}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950",
        size === "full" && "min-h-[200px]",
        className
      )}
    >
      <img
        src={displayUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("h-full w-full object-cover", imageClassName)}
        onError={() => {
          if (size === "thumb" && !useFullFallback) {
            setUseFullFallback(true);
            return;
          }
          setImgError(true);
        }}
      />
    </div>
  );
}

export { isMediaReference };
