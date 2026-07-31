/** Shared surface classes for the creative studio (LibTV-inspired, theme-aware). */
/** Shell matches workflow canvas in dark mode (--workflow-canvas-bg-dark). */
export const STUDIO_SHELL =
  "bg-background text-foreground dark:bg-[var(--workflow-canvas-bg-dark)]";

export const STUDIO_HEADER = "border-b border-border dark:border-neutral-700";

export const STUDIO_SCROLL = "studio-scrollbar";

/** List panels match generative node cards in dark mode. */
export const STUDIO_PANEL =
  "relative flex min-h-0 w-full flex-col rounded-xl border border-border bg-card dark:border-neutral-700 dark:bg-neutral-800";

export const STUDIO_PANEL_HEADER =
  "flex h-11 shrink-0 items-center justify-between px-4 py-3";

export const STUDIO_PANEL_TITLE = "text-sm font-medium leading-none text-foreground";

export const STUDIO_PANEL_COUNT = "text-xs text-muted-foreground/60";

/** Detail edit card — same surface as list panels. */
export const STUDIO_DETAIL_CARD =
  "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card dark:border-neutral-700 dark:bg-neutral-800";

/** Embedded bottom editor box (LibTV): wraps full dock content at card bottom. */
export const STUDIO_DOCK_PROMPT_BOX =
  "mx-3 mb-3 mt-2 flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg bg-muted/30 px-3 py-2 dark:bg-neutral-700/30";

export const STUDIO_DOCK_PROMPT_BOX_EXPANDED =
  "mx-3 mb-3 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-muted/30 px-3 py-2 dark:bg-neutral-700/30";

/** @deprecated Use STUDIO_DOCK_PROMPT_BOX on shell instead. */
export const STUDIO_DOCK_EMBEDDED =
  "flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent";

/** @deprecated Use STUDIO_DOCK_PROMPT_BOX on shell instead. */
export const STUDIO_DOCK_PROMPT =
  "rounded-lg bg-muted/30 px-3 py-2 dark:bg-neutral-700/30";

export const STUDIO_AUDIO_GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] content-start gap-2 py-1";

export const STUDIO_LIST_BODY =
  "studio-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-1.5 pb-2";

/** Row divider; vertical spacing via STUDIO_LIST_ITEM padding. */
export const STUDIO_LIST_ITEM =
  "relative border-b border-border/50 py-4 last:border-b-0 dark:border-neutral-700/50";

export const STUDIO_TEXT_LIST_ITEM = "relative py-1.5";

export const STUDIO_MEDIA_LIST_ITEM =
  "relative max-w-[300px] break-inside-avoid";

export const STUDIO_MEDIA_ITEM_HOVER =
  "pointer-events-none absolute -inset-1.5 rounded-xl bg-transparent transition-colors group-hover:bg-muted/25 dark:group-hover:bg-neutral-700/35";

export const STUDIO_MEDIA_ITEM_ACTIVE =
  "pointer-events-none absolute -inset-1.5 rounded-xl bg-muted/30 transition-colors dark:bg-neutral-700/40";

export const STUDIO_LIST_ITEM_CONTENT = "relative";

/** LibTV list node subtitle above preview. */
export const STUDIO_NODE_LABEL =
  "truncate text-xs font-normal text-muted-foreground";

/** LibTV list selection: full row height to dividers, rounded-lg overlay. */
export const STUDIO_ROW_ACTIVE =
  "pointer-events-none absolute -inset-x-2 inset-y-0 rounded-lg bg-muted/40 transition-colors dark:bg-neutral-700/50";

export const STUDIO_BOARD_GAP = "gap-3 p-4";

export const STUDIO_TILE_ACTIVE =
  "pointer-events-none absolute -inset-x-1 -inset-y-0.5 rounded-lg bg-muted/40 transition-colors dark:bg-neutral-700/50";

export const STUDIO_META_ROW = "flex min-w-0 flex-wrap items-center gap-1.5";

/** Outlined meta chip — border only, no fill (LibTV list footer tags). */
export const STUDIO_META_TAG =
  "inline-flex max-w-full shrink-0 items-center rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground dark:border-neutral-600";

export const STUDIO_TAB_BAR =
  "flex shrink-0 items-center justify-between gap-2 px-4 py-3";

export const STUDIO_TAB_GROUP = "flex items-center gap-1";

export const STUDIO_TAB =
  "inline-flex h-8 shrink-0 items-center rounded-md border border-border px-3 text-sm font-medium leading-none text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground dark:border-neutral-600 dark:hover:bg-neutral-700/40";

export const STUDIO_TAB_ACTIVE =
  "border-border bg-muted text-foreground dark:border-neutral-600 dark:bg-neutral-700";

export const STUDIO_TAB_EXPAND =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-600 dark:hover:bg-neutral-700/50";

export const STUDIO_PREVIEW_EMPTY =
  "bg-muted text-muted-foreground/50 dark:bg-neutral-700 dark:text-neutral-400/50";

export const STUDIO_PREVIEW_MEDIA_FALLBACK =
  "bg-muted text-muted-foreground dark:bg-neutral-700 dark:text-neutral-400";

export const STUDIO_DOCK =
  "border-t border-border bg-background/95 dark:border-neutral-700 dark:bg-[var(--workflow-canvas-bg-dark)]";

export const STUDIO_AUDIO_TILE_SQUARE =
  "relative aspect-square overflow-hidden rounded-lg bg-muted transition-colors dark:bg-neutral-700";

/** LibTV text list: compact icon + label row (~44px). */
export const STUDIO_TEXT_ROW =
  "group relative flex w-full items-center gap-2 py-1.5 text-left";

export const STUDIO_TEXT_ROW_HOVER =
  "pointer-events-none absolute -inset-x-1.5 inset-y-0.5 rounded-lg bg-transparent transition-colors group-hover:bg-muted/30 dark:group-hover:bg-neutral-700/40";

export const STUDIO_TEXT_ROW_ACTIVE =
  "pointer-events-none absolute -inset-x-1.5 inset-y-0.5 rounded-lg bg-muted/30 transition-colors dark:bg-neutral-700/40";

export const STUDIO_TEXT_ICON =
  "relative flex size-7 shrink-0 items-center justify-center rounded-[7px] border border-border/50 bg-card dark:border-neutral-600 dark:bg-neutral-800";

export const STUDIO_TEXT_LABEL =
  "relative min-w-0 flex-1 truncate text-[13px] leading-5 text-foreground";

export const STUDIO_MEDIA_CARD =
  "relative flex w-full flex-col gap-2.5 rounded-xl text-left transition-colors";

/** List preview slot: left-aligned; height follows media (capped in frame). */
export const STUDIO_MEDIA_PREVIEW_SLOT = "flex w-full justify-start";

export const STUDIO_MEDIA_PREVIEW =
  "relative max-w-full overflow-hidden rounded-xl border border-border/50 bg-card dark:border-neutral-700 dark:bg-neutral-800";

export const STUDIO_MEDIA_PREVIEW_VIDEO = "dark:bg-black";

export const STUDIO_MEDIA_PREVIEW_MEDIA =
  "size-full select-none object-contain";

/** LibTV reference chips in list cards: size-10, rounded-lg, object-cover. */
export const STUDIO_REFERENCE_THUMB_ROW =
  "flex items-center gap-1 overflow-hidden";

export const STUDIO_REFERENCE_THUMB =
  "relative size-10 shrink-0 overflow-hidden rounded-lg border border-border/50 object-cover";

export const STUDIO_REFERENCE_THUMB_FALLBACK =
  "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted dark:bg-neutral-700";

/** Empty list preview: same slot height as STUDIO_MEDIA_PREVIEW. */
export const STUDIO_MEDIA_PREVIEW_PLACEHOLDER =
  "flex flex-col items-center justify-center gap-1.5 text-muted-foreground/50";
