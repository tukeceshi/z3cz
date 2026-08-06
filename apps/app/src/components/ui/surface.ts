/**
 * Restrained dark surfaces — shared with workflow canvas and creative studio.
 * Light mode uses theme tokens; dark mode uses neutral-700/800 (not --card).
 */

/** Panel / card surface */
export const SURFACE_CARD =
  "border border-border bg-card dark:border-neutral-700 dark:bg-neutral-800";

/** Card with softer border */
export const SURFACE_CARD_SOFT =
  "border border-border/50 bg-card dark:border-neutral-700 dark:bg-neutral-800";

/** Muted inset block */
export const SURFACE_MUTED_INSET =
  "bg-muted/30 dark:bg-neutral-700/30";

/** Standard border */
export const SURFACE_BORDER = "border-border dark:border-neutral-700";

/** Soft divider */
export const SURFACE_DIVIDER = "border-border/50 dark:border-neutral-700/50";

/** Chip / control border */
export const SURFACE_BORDER_SUBTLE = "border-border dark:border-neutral-600";

/** Direct row hover */
export const SURFACE_ROW_HOVER =
  "transition-colors hover:bg-muted/25 dark:hover:bg-neutral-700/35";

/** Selected row */
export const SURFACE_ROW_ACTIVE = "bg-muted/30 dark:bg-neutral-700/40";

/** Stronger selected row */
export const SURFACE_ROW_ACTIVE_STRONG = "bg-muted/40 dark:bg-neutral-700/50";

/** Group-hover overlay fill */
export const SURFACE_GROUP_HOVER_FILL =
  "group-hover:bg-muted/30 dark:group-hover:bg-neutral-700/40";

/** Media tile group-hover */
export const SURFACE_MEDIA_HOVER_FILL =
  "group-hover:bg-muted/25 dark:group-hover:bg-neutral-700/35";

/** Control hover (tabs, buttons) */
export const SURFACE_CONTROL_HOVER =
  "hover:bg-muted/30 dark:hover:bg-neutral-700/40";

/** Control hover (stronger) */
export const SURFACE_CONTROL_HOVER_STRONG =
  "hover:bg-muted/50 dark:hover:bg-neutral-700/50";

/** Active tab / chip */
export const SURFACE_CONTROL_ACTIVE =
  "bg-muted text-foreground dark:bg-neutral-700";

/** Muted fill (previews, placeholders) */
export const SURFACE_MUTED_FILL = "bg-muted dark:bg-neutral-700";
