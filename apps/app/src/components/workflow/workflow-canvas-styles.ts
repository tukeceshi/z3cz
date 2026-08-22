/** PixVerse canvas reference — dark workflow editor background. */
export const WORKFLOW_CANVAS_BG_DARK = "#0b0b0f" as const;

export const WORKFLOW_CANVAS_CLASS = "workflow-canvas" as const;

/** Dot grid spacing — light and dark (PixVerse uses 20px). */
export const WORKFLOW_CANVAS_DOT_GAP_PX = 20;

export const WORKFLOW_CANVAS_DOT_DARK_FILL = "rgba(255, 255, 255, 0.25)" as const;

/** PixVerse selected node border in dark mode. */
export const WORKFLOW_NODE_SELECTED_BORDER_DARK = "#959595" as const;

export const WORKFLOW_NODE_SELECTED_BORDER_CLASS =
  "border-blue-500 dark:border-[#959595]" as const;

export const WORKFLOW_NODE_HANDLE_SELECTED_BORDER_CLASS =
  "border-blue-500! dark:border-[#959595]!" as const;

/** Set on <html> while Shift is held (native, so the first click is already gated). */
export const WORKFLOW_SHIFT_HELD_ATTR = "data-wf-shift-held" as const;

/** Canvas wrapper class while 2+ nodes stay selected after Shift is released. */
export const WORKFLOW_MULTI_SELECTED_CLASS = "wf-multi-selected" as const;

/** Outward padding for the multi-select drag rect (see index.css). */
export const WORKFLOW_MULTI_SELECT_OVERFLOW_PX = 30 as const;

/** Node internals that must not receive clicks during Shift / multi-select. */
export const WORKFLOW_NODE_CARD_INTERACT_CLASS = "wf-node-card-interact" as const;

export const WORKFLOW_NODE_BOTTOM_PANEL_GATE_CLASS =
  "wf-node-bottom-panel" as const;
