import type { ReactNode } from "react";

import { cn } from "@/utils/utils";

import { armGenerativePanelPointerGuard } from "./generative-panel-pointer-guard";
import {
  VIDEO_TRIM_PANEL_SHELL_CLASS,
  VIDEO_TRIM_PANEL_WIDTH_PX,
} from "./video-trim-panel-styles";

export interface GenerativeBottomPanelShellProps {
  readonly nodeId: string;
  readonly zoom: number;
  readonly widthPx?: number;
  readonly children: ReactNode;
}

/** Slim bottom panel shell for generative tools such as video trim. */
export function GenerativeBottomPanelShell({
  nodeId,
  zoom,
  widthPx = VIDEO_TRIM_PANEL_WIDTH_PX,
  children,
}: GenerativeBottomPanelShellProps) {
  const panelZoom = zoom > 0 ? zoom : 1;

  return (
    <div
      className={cn(
        "nodrag nopan nowheel absolute top-full left-1/2 z-20 mt-2",
        VIDEO_TRIM_PANEL_SHELL_CLASS
      )}
      style={{
        width: widthPx,
        transform: `translateX(-50%) scale(${1 / panelZoom})`,
        transformOrigin: "top center",
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerDownCapture={() => {
        armGenerativePanelPointerGuard(nodeId);
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
