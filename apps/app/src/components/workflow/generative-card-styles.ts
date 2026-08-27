/** Shared canvas card styling — aligned with the AI audio node reference. */
export const GENERATIVE_NODE_CARD_CLASS =
  "overflow-visible rounded-xl dark:bg-neutral-800" as const;

export const GENERATIVE_NODE_CARD_RADIUS_CLASS = "rounded-xl" as const;

/** Bottom config panel shell — matches canvas card color in dark mode. */
export const GENERATIVE_NODE_PANEL_CLASS =
  "rounded-xl dark:bg-neutral-800/95" as const;

/** Top toolbar buttons — borderless, hover fill (LibTV-style). */
export const GENERATIVE_NODE_PANEL_TOOLBAR_BUTTON_CLASS =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-normal text-foreground/80 transition-colors hover:bg-neutral-200/70 disabled:pointer-events-none disabled:opacity-35 dark:text-neutral-200 dark:hover:bg-neutral-700/70" as const;

export const GENERATIVE_NODE_PANEL_TOOLBAR_DIVIDER_CLASS =
  "mx-0.5 h-4 w-px bg-border/70 dark:bg-neutral-600" as const;

export const GENERATIVE_NODE_PANEL_TOOLBAR_ICON_CLASS = "size-4" as const;

/** Card center labels: upload placeholder, generating, cancelled, etc. */
export const GENERATIVE_CARD_STATE_LABEL_CLASS =
  "text-center text-base leading-snug text-muted-foreground/70" as const;
