import type { ReactNode } from "react";

import { cn } from "@/utils/utils";

import {
  AI_GENERATIVE_PANEL_HEIGHT_PX,
  AI_GENERATIVE_PANEL_WIDTH_PX,
} from "./ai-generative-panel-utils";
import { GENERATIVE_NODE_PANEL_CLASS } from "./generative-card-styles";
import { armGenerativePanelPointerGuard } from "./generative-panel-pointer-guard";
import {
  STUDIO_DOCK_PROMPT_BOX,
  STUDIO_DOCK_PROMPT_BOX_EXPANDED,
  STUDIO_SCROLL,
} from "./creative-studio-surface";
import type { StudioDockSize } from "./generative-studio-dock-layout";

export type GenerativeConfigPanelLayout = "attached" | "studio" | "studio-dock";

export interface GenerativeConfigPanelShellProps {
  readonly nodeId: string;
  readonly zoom: number;
  readonly layout?: GenerativeConfigPanelLayout;
  readonly studioDockSize?: StudioDockSize;
  readonly children: ReactNode;
}

/** Shared bottom editor shell for AI text / AI image nodes. */
export function GenerativeConfigPanelShell({
  nodeId,
  zoom,
  layout = "attached",
  studioDockSize = "compact",
  children,
}: GenerativeConfigPanelShellProps) {
  if (layout === "studio-dock") {
    const boxClass =
      studioDockSize === "expanded"
        ? STUDIO_DOCK_PROMPT_BOX_EXPANDED
        : cn(STUDIO_DOCK_PROMPT_BOX, "h-[270px]");

    return (
      <div
        className={cn("nodrag nopan nowheel", boxClass, STUDIO_SCROLL)}
        onClick={(event) => event.stopPropagation()}
        onPointerDownCapture={(event) => {
          event.stopPropagation();
          armGenerativePanelPointerGuard(nodeId);
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  if (layout === "studio") {
    return (
      <div
        className="nodrag nopan nowheel flex h-full min-h-0 flex-col overflow-hidden px-4 py-3"
        onClick={(event) => event.stopPropagation()}
        onPointerDownCapture={(event) => {
          event.stopPropagation();
          armGenerativePanelPointerGuard(nodeId);
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    );
  }

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
