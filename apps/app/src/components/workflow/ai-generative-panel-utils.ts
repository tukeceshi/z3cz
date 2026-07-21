/** Shared bottom editor panel dimensions for AI generative nodes. */
export const AI_GENERATIVE_PANEL_WIDTH_PX = 640;
export const AI_GENERATIVE_PANEL_HEIGHT_PX = 336;
export const AI_GENERATIVE_PANEL_PROMPT_MIN_HEIGHT_PX = 220;

/** Below this canvas zoom, node bottom config panels are hidden (30%). */
export const WORKFLOW_BOTTOM_PANEL_MIN_ZOOM = 0.3;

export function isWorkflowBottomPanelVisible(zoom: number): boolean {
  return Number.isFinite(zoom) && zoom >= WORKFLOW_BOTTOM_PANEL_MIN_ZOOM;
}
