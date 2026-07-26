import type { ObjectReference } from "@dafthunk/types";
import Folder from "lucide-react/icons/folder";
import ImageIcon from "lucide-react/icons/image";
import { useMemo } from "react";

import { createObjectUrl } from "@/services/object-service";
import { cn } from "@/utils/utils";

interface WorkflowLibraryPreviewProps {
  orgId: string;
  coverObjectId?: string | null;
  coverMimeType?: string | null;
  fallbackLabel?: string;
  variant: "create" | "folder" | "workflow";
  className?: string;
}

export function WorkflowLibraryPreview({
  orgId,
  coverObjectId,
  coverMimeType,
  fallbackLabel,
  variant,
  className,
}: WorkflowLibraryPreviewProps) {
  const coverUrl = useMemo(() => {
    if (!coverObjectId || !coverMimeType || !orgId) {
      return null;
    }
    const reference: ObjectReference = {
      id: coverObjectId,
      mimeType: coverMimeType,
    };
    return createObjectUrl(reference, orgId);
  }, [coverObjectId, coverMimeType, orgId]);

  if (variant === "create") {
    return (
      <div
        className={cn(
          "flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 text-muted-foreground",
          className
        )}
      >
        <span className="text-3xl leading-none">+</span>
        {fallbackLabel ? (
          <span className="text-sm font-medium">{fallbackLabel}</span>
        ) : null}
      </div>
    );
  }

  if (coverUrl) {
    return (
      <div
        className={cn(
          "aspect-video w-full overflow-hidden rounded-lg border bg-muted/30",
          className
        )}
      >
        <img
          src={coverUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (variant === "folder") {
    return (
      <div
        className={cn(
          "flex aspect-video w-full items-center justify-center rounded-lg border bg-gradient-to-b from-muted/50 to-muted",
          className
        )}
      >
        <Folder className="h-16 w-16 text-muted-foreground/70" strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex aspect-video w-full flex-col items-center justify-center rounded-lg border bg-muted/30 px-4 text-center",
        className
      )}
    >
      {fallbackLabel ? (
        <p className="line-clamp-3 text-sm font-medium text-muted-foreground">
          {fallbackLabel}
        </p>
      ) : (
        <ImageIcon className="h-10 w-10 text-muted-foreground/50" strokeWidth={1.25} />
      )}
    </div>
  );
}
