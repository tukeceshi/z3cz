import type { ReactNode } from "react";

import { cn } from "@/utils/utils";

import {
  AI_GENERATIVE_PANEL_HEIGHT_PX,
  AI_GENERATIVE_PANEL_WIDTH_PX,
} from "./ai-generative-panel-utils";
import { GENERATIVE_NODE_PANEL_CLASS } from "./generative-card-styles";
import { armGenerativePanelPointerGuard } from "./generative-panel-pointer-guard";

export interface GenerativeConfigPanelShellProps {
  readonly nodeId: string;
  readonly zoom: number;
  readonly children: ReactNode;
}

/** Shared bottom editor shell for AI text / AI image nodes. */
export function GenerativeConfigPanelShell({
  nodeId,
  zoom,
  children,
}: GenerativeConfigPanelShellProps) {
  const panelZoom = zoom > 0 ? zoom : 1;

  return (
    <div
      className={cn(
        "nodrag nopan nowheel absolute top-full left-1/2 z-20 -mt-px",
        "overflow-hidden border border-t-0 border-border/70",
        "bg-neutral-50/95 shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
        GENERATIVE_NODE_PANEL_CLASS
      )}
      style={{
        width: AI_GENERATIVE_PANEL_WIDTH_PX,
        height: AI_GENERATIVE_PANEL_HEIGHT_PX,
        transform: `translateX(-50%) scale(${1 / panelZoom})`,
        transformOrigin: "top center",
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDownCapture={(event) => {
        event.stopPropagation();
        armGenerativePanelPointerGuard(nodeId);
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex h-full flex-col px-3 pb-3 pt-2">{children}</div>
    </div>
  );
}
