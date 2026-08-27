import type { ReactNode } from "react";

import { cn } from "@/utils/utils";

import { GENERATIVE_NODE_PANEL_CLASS } from "./generative-card-styles";

export interface GenerativeNodeTopToolbarShellProps {
  readonly zoom: number;
  readonly children: ReactNode;
}

/** Fixed-size bar — inverse-scales with canvas zoom; parent handles placement. */
export function GenerativeNodeTopToolbarShell({
  zoom,
  children,
}: GenerativeNodeTopToolbarShellProps) {
  const panelZoom = zoom > 0 ? zoom : 1;

  return (
    <div
      className={cn(
        "nodrag nopan nowheel flex h-[35px] w-max max-w-none flex-nowrap items-center gap-1 border border-border/70 px-1",
        "bg-neutral-50/95 shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
        GENERATIVE_NODE_PANEL_CLASS
      )}
      style={{
        transform: `scale(${1 / panelZoom})`,
        transformOrigin: "bottom center",
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
