/** Pairs with `.thin-scrollbar` in index.css (org single-model picker & canvas lists). */
export const LIST_SCROLL_CLASS = "thin-scrollbar overflow-y-auto pr-1" as const;

/** Page / panel scroll container — no extra padding. */
export const PAGE_SCROLL_CLASS = "thin-scrollbar overflow-y-auto" as const;

/** Dialog detail blocks — long JSON / URLs scroll inside, not the dialog. */
export const DETAIL_PRE_CLASS =
  "thin-scrollbar max-w-full overflow-auto break-all whitespace-pre-wrap text-xs" as const;
