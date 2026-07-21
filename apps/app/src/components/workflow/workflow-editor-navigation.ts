export interface WorkflowEditorLocationState {
  readonly initialViewportOneToOne?: boolean;
}

/** Navigation state for opening a newly created workflow at 100% zoom once. */
export function createWorkflowEditorLocationState(): WorkflowEditorLocationState {
  return { initialViewportOneToOne: true };
}

export function readInitialViewportOneToOne(
  state: unknown
): boolean {
  if (!state || typeof state !== "object") {
    return false;
  }
  return (
    (state as WorkflowEditorLocationState).initialViewportOneToOne === true
  );
}
