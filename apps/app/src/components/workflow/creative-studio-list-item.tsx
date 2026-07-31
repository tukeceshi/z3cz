import type { ReactNode } from "react";

import { cn } from "@/utils/utils";

import {
  STUDIO_LIST_ITEM,
  STUDIO_LIST_ITEM_CONTENT,
  STUDIO_MEDIA_ITEM_ACTIVE,
  STUDIO_MEDIA_ITEM_HOVER,
  STUDIO_MEDIA_LIST_ITEM,
  STUDIO_ROW_ACTIVE,
  STUDIO_TEXT_LIST_ITEM,
  STUDIO_TEXT_ROW_ACTIVE,
} from "./creative-studio-surface";

export interface CreativeStudioListItemProps {
  readonly isActive?: boolean;
  readonly focusId?: string;
  readonly className?: string;
  readonly variant?: "default" | "text" | "media" | "mediaPlain";
  readonly children: ReactNode;
}

export function CreativeStudioListItem({
  isActive = false,
  focusId,
  className,
  variant = "default",
  children,
}: CreativeStudioListItemProps) {
  const itemClassName =
    variant === "text"
      ? STUDIO_TEXT_LIST_ITEM
      : variant === "media" || variant === "mediaPlain"
        ? cn(STUDIO_MEDIA_LIST_ITEM, variant === "media" ? "group" : undefined)
        : STUDIO_LIST_ITEM;
  const activeClassName =
    variant === "text"
      ? STUDIO_TEXT_ROW_ACTIVE
      : variant === "media"
        ? STUDIO_MEDIA_ITEM_ACTIVE
        : variant === "mediaPlain"
          ? null
          : STUDIO_ROW_ACTIVE;
  const hoverClassName = variant === "media" ? STUDIO_MEDIA_ITEM_HOVER : null;

  return (
    <div className={itemClassName} data-studio-focus-id={focusId}>
      {hoverClassName ? <span className={hoverClassName} aria-hidden="true" /> : null}
      {isActive && activeClassName ? (
        <span className={activeClassName} aria-hidden="true" />
      ) : null}
      <div className={cn(STUDIO_LIST_ITEM_CONTENT, "relative", className)}>
        {children}
      </div>
    </div>
  );
}
