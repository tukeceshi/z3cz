export interface StudioListEditorState {
  readonly hasPrimary: boolean;
  readonly hasSecondary: boolean;
  readonly primaryNodeId: string | null;
  readonly secondaryNodeId: string | null;
}

export interface StudioListNodeActions {
  readonly openPrimary: (nodeId: string) => void;
  readonly openSecondary: (nodeId: string) => void;
  readonly replacePrimary: (nodeId: string) => void;
  readonly promoteSecondaryToPrimary: (nodeId: string) => void;
}

export function handleStudioListNodeClick(
  nodeId: string,
  state: StudioListEditorState,
  actions: StudioListNodeActions
): void {
  if (!state.hasPrimary) {
    actions.openPrimary(nodeId);
    return;
  }

  if (state.hasSecondary) {
    if (
      nodeId === state.primaryNodeId ||
      nodeId === state.secondaryNodeId
    ) {
      return;
    }
    actions.openSecondary(nodeId);
    return;
  }

  if (nodeId === state.primaryNodeId) {
    return;
  }

  actions.openSecondary(nodeId);
}

export function handleStudioListNodeDoubleClick(
  nodeId: string,
  state: StudioListEditorState,
  actions: StudioListNodeActions
): void {
  if (!state.hasPrimary) {
    actions.openPrimary(nodeId);
    return;
  }

  if (state.hasSecondary && nodeId === state.secondaryNodeId) {
    actions.promoteSecondaryToPrimary(nodeId);
    return;
  }

  actions.replacePrimary(nodeId);
}
