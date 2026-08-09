/** Shared surface classes for the creative studio (LibTV-inspired, theme-aware). */
import {
  SURFACE_BORDER,
  SURFACE_BORDER_SUBTLE,
  SURFACE_CARD,
  SURFACE_CARD_SOFT,
  SURFACE_CONTROL_ACTIVE,
  SURFACE_CONTROL_HOVER,
  SURFACE_CONTROL_HOVER_STRONG,
  SURFACE_DIVIDER,
  SURFACE_GROUP_HOVER_FILL,
  SURFACE_MEDIA_HOVER_FILL,
  SURFACE_MUTED_FILL,
  SURFACE_MUTED_INSET,
  SURFACE_ROW_ACTIVE,
  SURFACE_ROW_ACTIVE_STRONG,
} from "@/components/ui/surface";

/** Shell matches workflow canvas in dark mode (--workflow-canvas-bg-dark). */
export const STUDIO_SHELL =
  "bg-background text-foreground dark:bg-[var(--workflow-canvas-bg-dark)]";

export const STUDIO_HEADER = `border-b ${SURFACE_BORDER}`;

export const STUDIO_SCROLL = "thin-scrollbar";

/** List panels match generative node cards in dark mode. */
export const STUDIO_PANEL = `relative flex min-h-0 w-full flex-col rounded-xl ${SURFACE_CARD}`;

export const STUDIO_PANEL_HEADER =
  "flex h-11 shrink-0 items-center justify-between px-4 py-3";

export const STUDIO_PANEL_TITLE = "text-sm font-medium leading-none text-foreground";

export const STUDIO_PANEL_COUNT = "text-xs text-muted-foreground/60";

/** Detail edit card — same surface as list panels. */
export const STUDIO_DETAIL_CARD = `flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ${SURFACE_CARD}`;

/** Embedded bottom editor box (LibTV): wraps full dock content at card bottom. */
export const STUDIO_DOCK_PROMPT_BOX = `mx-3 mb-3 mt-2 flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg ${SURFACE_MUTED_INSET} px-3 py-2`;

export const STUDIO_DOCK_PROMPT_BOX_EXPANDED = `mx-3 mb-3 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg ${SURFACE_MUTED_INSET} px-3 py-2`;

/** @deprecated Use STUDIO_DOCK_PROMPT_BOX on shell instead. */
export const STUDIO_DOCK_EMBEDDED =
  "flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent";

/** @deprecated Use STUDIO_DOCK_PROMPT_BOX on shell instead. */
export const STUDIO_DOCK_PROMPT = `rounded-lg ${SURFACE_MUTED_INSET} px-3 py-2`;

export const STUDIO_LIST_BODY =
  "thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-1.5 pb-2";

/** Row divider; vertical spacing via STUDIO_LIST_ITEM padding. */
export const STUDIO_LIST_ITEM = `relative border-b ${SURFACE_DIVIDER} py-4 last:border-b-0`;

export const STUDIO_TEXT_LIST_ITEM = "relative py-1.5";

export const STUDIO_MEDIA_LIST_ITEM =
  "relative max-w-[300px] break-inside-avoid";

export const STUDIO_MEDIA_ITEM_HOVER = `pointer-events-none absolute -inset-1.5 rounded-xl bg-transparent transition-colors ${SURFACE_MEDIA_HOVER_FILL}`;

export const STUDIO_MEDIA_ITEM_ACTIVE = `pointer-events-none absolute -inset-1.5 rounded-xl ${SURFACE_ROW_ACTIVE} transition-colors`;

export const STUDIO_LIST_ITEM_CONTENT = "relative";

/** LibTV list node subtitle above preview. */
export const STUDIO_NODE_LABEL =
  "truncate text-xs font-normal text-muted-foreground";

/** LibTV list selection: full row height to dividers, rounded-lg overlay. */
export const STUDIO_ROW_ACTIVE = `pointer-events-none absolute -inset-x-2 inset-y-0 rounded-lg ${SURFACE_ROW_ACTIVE_STRONG} transition-colors`;

export const STUDIO_BOARD_GAP = "gap-3";

/** Outer padding for full-width studio board (not split with detail). */
export const STUDIO_BOARD_INSET = "p-4";

/** Compact list: add-node slot between tabs and node list. */
export const STUDIO_ADD_NODE_SLOT = `flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed bg-transparent text-sm ${SURFACE_BORDER_SUBTLE} text-muted-foreground transition-colors hover:text-foreground`;

/** List item row menu trigger (⋯) — icon only, no background box. */
export const STUDIO_LIST_ITEM_MENU_TRIGGER =
  "flex size-4 shrink-0 items-center justify-center bg-transparent text-muted-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:ring-0";

/** Name + ⋯ on one line without extra row height. */
export const STUDIO_NODE_LABEL_ROW = "flex h-4 min-h-0 items-center gap-0.5";

/** Compact row action menu — canvas card surfaces, not default popover black. */
export const STUDIO_LIST_ITEM_MENU_CONTENT = `w-auto min-w-0 overflow-hidden rounded-md p-0.5 shadow-md ${SURFACE_CARD_SOFT}`;

/** Delete row — text only, minimal hit target. */
export const STUDIO_LIST_ITEM_MENU_DELETE = `h-auto justify-center px-2 py-0.5 text-xs text-destructive focus:text-destructive focus:bg-muted/30 dark:focus:bg-neutral-700/40`;

export const STUDIO_TILE_ACTIVE = `pointer-events-none absolute -inset-x-1 -inset-y-0.5 rounded-lg ${SURFACE_ROW_ACTIVE_STRONG} transition-colors`;

export const STUDIO_META_ROW = "flex min-w-0 flex-wrap items-center gap-1";

/** Outlined meta chip — border only, no fill (LibTV list footer tags). */
export const STUDIO_META_TAG = `inline-flex max-w-full shrink-0 items-center rounded-sm border ${SURFACE_BORDER_SUBTLE} px-1 py-px text-[10px] text-muted-foreground`;

export const STUDIO_TAB_BAR =
  "flex shrink-0 items-center justify-between gap-2 px-4 py-3";

/** Segmented control track — single muted pill wrapping all tabs. */
export const STUDIO_TAB_GROUP = `flex min-w-0 flex-1 items-center gap-0.5 rounded-lg p-0.5 ${SURFACE_MUTED_INSET}`;

export const STUDIO_TAB =
  "inline-flex h-7 min-w-0 flex-1 items-center justify-center truncate rounded-md px-1.5 text-xs font-medium leading-none text-muted-foreground transition-colors hover:text-foreground";

export const STUDIO_TAB_ACTIVE =
  "bg-background text-foreground shadow-sm dark:bg-neutral-600";

export const STUDIO_TAB_EXPAND = `flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${SURFACE_BORDER_SUBTLE} text-muted-foreground transition-colors ${SURFACE_CONTROL_HOVER_STRONG} hover:text-foreground disabled:pointer-events-none disabled:opacity-40`;

export const STUDIO_PREVIEW_EMPTY = `${SURFACE_MUTED_FILL} text-muted-foreground/50 dark:text-neutral-400/50`;

export const STUDIO_PREVIEW_MEDIA_FALLBACK = `${SURFACE_MUTED_FILL} text-muted-foreground dark:text-neutral-400`;

export const STUDIO_DOCK = `border-t ${SURFACE_BORDER} bg-background/95 dark:bg-[var(--workflow-canvas-bg-dark)]`;

/** Fixed list preview height — audio preview slot; shared constraint pattern with text cards. */
export const STUDIO_LIST_PREVIEW_HEIGHT = "h-[66px]";

export const STUDIO_AUDIO_TILE_PREVIEW = `relative w-full overflow-hidden rounded-lg ${STUDIO_LIST_PREVIEW_HEIGHT} ${SURFACE_MUTED_FILL} transition-colors`;

/** LibTV text list: compact icon + label row (~44px). */
export const STUDIO_TEXT_ROW =
  "group relative flex w-full items-center gap-2 py-1.5 text-left";

export const STUDIO_TEXT_ROW_HOVER = `pointer-events-none absolute -inset-x-1.5 inset-y-0.5 rounded-lg bg-transparent transition-colors ${SURFACE_GROUP_HOVER_FILL}`;

export const STUDIO_TEXT_ROW_ACTIVE = `pointer-events-none absolute -inset-x-1.5 inset-y-0.5 rounded-lg ${SURFACE_ROW_ACTIVE} transition-colors`;

export const STUDIO_TEXT_ICON =
  "relative flex size-7 shrink-0 items-center justify-center rounded-[7px] border border-border/50 bg-card dark:border-neutral-600 dark:bg-neutral-800";

export const STUDIO_TEXT_LABEL =
  "relative min-w-0 flex-1 truncate text-[13px] leading-5 text-foreground";

export const STUDIO_MEDIA_CARD =
  "relative flex w-full flex-col gap-1.5 rounded-xl text-left transition-colors";

/** Name + meta tags below media preview. */
export const STUDIO_MEDIA_CARD_FOOTER = "flex flex-col gap-0.5";

/** Vertical spacing inside text list cards (name / body / tags). */
export const STUDIO_TEXT_CARD_GAP = "gap-1.5";

/** Studio text detail body — shared by browse and edit (single textarea). */
export const STUDIO_TEXT_DETAIL_BODY =
  "block w-full min-h-full resize-none overflow-hidden rounded-lg border-0 bg-transparent p-3 text-base leading-relaxed text-foreground/90 shadow-none focus-visible:border-0 focus-visible:ring-0";

export const STUDIO_TEXT_DETAIL_EDIT_OVERLAY =
  "pointer-events-none absolute inset-0 rounded-lg bg-muted/40 ring-1 ring-inset ring-border/70 dark:bg-neutral-900/50 dark:ring-neutral-600";

/** Plain text segment in formatted view (browse + in-place edit). */
export const STUDIO_TEXT_PLAIN_SEGMENT =
  "studio-text-segment studio-text-mdx-body w-full text-base leading-relaxed text-foreground/90 whitespace-pre-wrap break-words font-sans";

export const STUDIO_TEXT_PLAIN_SEGMENT_EDIT =
  "studio-text-segment-edit block w-full min-h-0 resize-none overflow-hidden border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0";

/** Studio MDXEditor body — typography only; table styles live in index.css under .studio-mdx-editor */
export const STUDIO_TEXT_MDX_BODY =
  "studio-text-mdx-body text-base leading-relaxed text-foreground/90";

/** Bottom-left formatted / raw view toggle shell. */
export const STUDIO_TEXT_VIEW_TOGGLE =
  "rounded-md border border-border/40 bg-background/70 p-0.5 backdrop-blur-sm dark:bg-neutral-900/70";

/** List preview slot: left-aligned; height follows media (capped in frame). */
export const STUDIO_MEDIA_PREVIEW_SLOT = "flex w-full justify-start";

export const STUDIO_MEDIA_PREVIEW = `relative max-w-full overflow-hidden rounded-xl ${SURFACE_CARD_SOFT}`;

export const STUDIO_MEDIA_PREVIEW_VIDEO = "dark:bg-black";

export const STUDIO_MEDIA_PREVIEW_MEDIA =
  "size-full select-none object-contain";

/** LibTV reference chips in list cards: size-10, rounded-lg, object-cover. */
export const STUDIO_REFERENCE_THUMB_ROW =
  "flex items-center gap-1 overflow-hidden";

export const STUDIO_REFERENCE_THUMB =
  "relative size-10 shrink-0 overflow-hidden rounded-lg border border-border/50 object-cover";

export const STUDIO_REFERENCE_THUMB_FALLBACK = `flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/50 ${SURFACE_MUTED_FILL}`;

/** Empty list preview: same slot height as STUDIO_MEDIA_PREVIEW. */
export const STUDIO_MEDIA_PREVIEW_PLACEHOLDER =
  "flex flex-col items-center justify-center gap-1.5 text-muted-foreground/50";
