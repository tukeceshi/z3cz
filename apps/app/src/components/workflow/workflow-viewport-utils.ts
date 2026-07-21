import type { WorkflowEditorViewport } from "@dafthunk/types";

export function isValidWorkflowEditorViewport(
  value: unknown
): value is WorkflowEditorViewport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as WorkflowEditorViewport;
  return (
    Number.isFinite(candidate.x) &&
    Number.isFinite(candidate.y) &&
    Number.isFinite(candidate.zoom) &&
    candidate.zoom > 0
  );
}

export function normalizeWorkflowEditorViewport(
  viewport: WorkflowEditorViewport
): WorkflowEditorViewport {
  return {
    x: viewport.x,
    y: viewport.y,
    zoom: viewport.zoom,
  };
}
