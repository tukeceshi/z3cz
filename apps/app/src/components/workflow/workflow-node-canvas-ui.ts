/** Transient canvas-only fields merged into node.data at render time (not persisted). */
export interface WorkflowNodeCanvasUiData {
  readonly connectedHandleKeys?: readonly string[];
  readonly showBottomPanelHost?: boolean;
  readonly viewportZoom?: number;
  readonly isViewportMoving?: boolean;
}

export const WORKFLOW_NODE_CANVAS_UI_KEYS = [
  "connectedHandleKeys",
  "showBottomPanelHost",
  "viewportZoom",
  "isViewportMoving",
] as const;

export function stripWorkflowNodeCanvasUi<T extends Record<string, unknown>>(
  data: T
): Omit<T, (typeof WORKFLOW_NODE_CANVAS_UI_KEYS)[number]> {
  const next = { ...data };
  for (const key of WORKFLOW_NODE_CANVAS_UI_KEYS) {
    delete next[key];
  }
  return next;
}
