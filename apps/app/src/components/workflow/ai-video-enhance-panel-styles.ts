import { cn } from "@/utils/utils";

import { GENERATIVE_NODE_PANEL_CLASS } from "./generative-card-styles";

export const AI_VIDEO_ENHANCE_PANEL_WIDTH_PX = 320 as const;

export const AI_VIDEO_ENHANCE_PANEL_SHELL_CLASS = cn(
  "overflow-hidden border border-border/70 bg-neutral-50/95 shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
  GENERATIVE_NODE_PANEL_CLASS
);

export const AI_VIDEO_ENHANCE_PANEL_POPOVER_CLASS = cn(
  "p-0",
  AI_VIDEO_ENHANCE_PANEL_SHELL_CLASS
);

export const AI_VIDEO_ENHANCE_PANEL_ACTIONS_CLASS =
  "flex justify-end px-3 pb-3 pt-2" as const;
