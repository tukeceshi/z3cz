/** LibTV-style circular hit zone (px). */
export const GENERATIVE_EDGE_HANDLE_HIT_PX = 80;
/** Visible plus icon (px). */
export const GENERATIVE_EDGE_PLUS_PX = 20;
/** Gap between card border and nearest plus edge (px). */
export const GENERATIVE_EDGE_PLUS_BORDER_GAP_PX = 10;
/** Plus band outside the border (gap + icon). */
export const GENERATIVE_EDGE_PLUS_OUTER_PX =
  GENERATIVE_EDGE_PLUS_BORDER_GAP_PX + GENERATIVE_EDGE_PLUS_PX;
/** Interaction shell width: handle zone + outer plus band. */
export const GENERATIVE_EDGE_SHELL_W_PX =
  GENERATIVE_EDGE_HANDLE_HIT_PX + GENERATIVE_EDGE_PLUS_OUTER_PX;

/** Backward-compatible aliases — prefer GENERATIVE_EDGE_* in new code. */
export const AI_TEXT_HANDLE_HIT_PX = GENERATIVE_EDGE_HANDLE_HIT_PX;
export const AI_TEXT_HANDLE_PLUS_PX = GENERATIVE_EDGE_PLUS_PX;
export const AI_TEXT_PLUS_BORDER_GAP_PX = GENERATIVE_EDGE_PLUS_BORDER_GAP_PX;
export const AI_TEXT_EDGE_PLUS_OUTER_PX = GENERATIVE_EDGE_PLUS_OUTER_PX;
export const AI_TEXT_EDGE_SHELL_W_PX = GENERATIVE_EDGE_SHELL_W_PX;
