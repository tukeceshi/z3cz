import type { ReactNode } from "react";

import { cn } from "@/utils/utils";

export interface StudioTextTableBoundaryProps {
  readonly followsText: boolean;
  readonly mode: "preview" | "edit";
  readonly className?: string;
  readonly children: ReactNode;
}

/** Hidden leading `|` slot — table owns the boundary after `\n\n` without mutating text. */
export function StudioTextTableBoundary({
  followsText,
  mode,
  className,
  children,
}: StudioTextTableBoundaryProps) {
  return (
    <div
      className={cn("studio-mdx-table-boundary", className)}
      data-follows-text={followsText ? "true" : undefined}
      data-table-mode={mode}
    >
      <div className="studio-mdx-table-leading-pipe" aria-hidden>
        |
      </div>
      {children}
    </div>
  );
}
