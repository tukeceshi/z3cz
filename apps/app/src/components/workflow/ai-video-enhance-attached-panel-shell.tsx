import type { ReactNode } from "react";

import { cn } from "@/utils/utils";

import {
  AI_VIDEO_ENHANCE_PANEL_SHELL_CLASS,
  AI_VIDEO_ENHANCE_PANEL_WIDTH_PX,
} from "./ai-video-enhance-panel-styles";
import { armGenerativePanelPointerGuard } from "./generative-panel-pointer-guard";

export interface AiVideoEnhanceAttachedPanelShellProps {
  readonly nodeId: string;
  readonly zoom: number;
  readonly children: ReactNode;
}

/** Canvas bottom panel shell — same width and look as the toolbar popover. */
export function AiVideoEnhanceAttachedPanelShell({
  nodeId,
  zoom,
  children,
}: AiVideoEnhanceAttachedPanelShellProps) {
  const panelZoom = zoom > 0 ? zoom : 1;

  return (
    <div
      className={cn(
        "nodrag nopan nowheel absolute top-full left-1/2 z-20 mt-2",
        AI_VIDEO_ENHANCE_PANEL_SHELL_CLASS
      )}
      style={{
        width: AI_VIDEO_ENHANCE_PANEL_WIDTH_PX,
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
