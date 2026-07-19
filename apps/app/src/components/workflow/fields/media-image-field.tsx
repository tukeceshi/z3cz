import {
  isMediaReference,
  type MediaReference,
  type ObjectReference,
} from "@dafthunk/types";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";
import { useAuth } from "@/components/auth-context";
import {
  isMediaExpired,
  resolveMediaDisplayUrl,
} from "@/services/media-url-resolver";

export interface MediaImageFieldProps {
  readonly value: MediaReference | unknown;
  readonly createObjectUrl?: (ref: ObjectReference) => string;
  readonly className?: string;
}

export function MediaImageField({
  value,
  createObjectUrl,
  className,
}: MediaImageFieldProps) {
  const { t } = useTranslation();
  const { organization } = useAuth();
  const { id: workflowId } = useParams<{ id: string }>();
  const orgId = organization?.id ?? "";
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const media = isMediaReference(value) ? value : null;
  const expired = media ? isMediaExpired(media) : false;

  useEffect(() => {
    let revoked: string | null = null;
    setStale(false);

    if (!media || !orgId || !workflowId) {
      setDisplayUrl(null);
      return;
    }

    if (expired) {
      setDisplayUrl(null);
      setStale(true);
      return;
    }

    let cancelled = false;
    void resolveMediaDisplayUrl({
      media,
      organizationId: orgId,
      workflowId,
      createObjectUrl,
    }).then((url) => {
      if (cancelled) {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
        return;
      }
      if (!url) {
        setDisplayUrl(null);
        setStale(true);
        return;
      }
      if (url.startsWith("blob:")) revoked = url;
      setDisplayUrl(url);
    });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [media, orgId, workflowId, createObjectUrl, expired]);

  if (!media) {
    return null;
  }

  if (stale || !displayUrl) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400",
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
        className
      )}
    >
      <img
        src={displayUrl}
        alt=""
        className="h-full w-full object-cover"
        onError={() => {
          setDisplayUrl(null);
          setStale(true);
        }}
      />
    </div>
  );
}
