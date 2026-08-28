import { cn } from "@/utils/utils";

import { GENERATIVE_NODE_PANEL_CLASS } from "./generative-card-styles";

export const VIDEO_TRIM_PANEL_WIDTH_PX = 640 as const;

export const VIDEO_TRIM_PANEL_SHELL_CLASS = cn(
  "overflow-hidden rounded-md border border-border/70 bg-neutral-50/95 shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:bg-neutral-800/95",
  GENERATIVE_NODE_PANEL_CLASS
);

export const VIDEO_TRIM_PANEL_RULER_ROW_CLASS =
  "flex items-center gap-2 border-b border-border/60 px-2 py-2" as const;

export const VIDEO_TRIM_PANEL_FOOTER_CLASS =
  "grid grid-cols-[1fr_auto_1fr] items-end gap-2 px-3 py-2.5" as const;

export const VIDEO_TRIM_PANEL_FOOTER_LEFT_CLASS =
  "flex min-w-0 items-center justify-self-start" as const;

export const VIDEO_TRIM_PANEL_FOOTER_CENTER_CLASS =
  "flex justify-center justify-self-center" as const;

export const VIDEO_TRIM_PANEL_FOOTER_ACTIONS_CLASS =
  "flex items-center justify-end gap-1 justify-self-end" as const;

export const VIDEO_TRIM_PANEL_ACTION_BUTTON_CLASS =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-normal text-foreground/80 transition-colors hover:bg-neutral-200/70 disabled:pointer-events-none disabled:opacity-35 dark:text-neutral-200 dark:hover:bg-neutral-700/70" as const;

export const VIDEO_TRIM_PANEL_PRIMARY_BUTTON_CLASS =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium bg-neutral-800 text-neutral-50 transition-colors hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200" as const;
