/** Shared canvas card styling — aligned with the AI audio node reference. */
export const GENERATIVE_NODE_CARD_CLASS =
  "overflow-visible rounded-xl dark:bg-neutral-800" as const;

export const GENERATIVE_NODE_CARD_RADIUS_CLASS = "rounded-xl" as const;

/** Bottom config panel shell — matches canvas card color in dark mode. */
export const GENERATIVE_NODE_PANEL_CLASS =
  "rounded-b-xl dark:bg-neutral-800/95" as const;

/** Card center labels: upload placeholder, generating, cancelled, etc. */
export const GENERATIVE_CARD_STATE_LABEL_CLASS =
  "text-center text-base leading-snug text-muted-foreground/70" as const;
