export interface StudioListEditorState {
  readonly hasPrimary: boolean;
  readonly hasSecondary: boolean;
  readonly primaryNodeId: string | null;
}

export interface StudioListNodeActions {
  readonly openPrimary: (nodeId: string) => void;
  readonly openSecondary: (nodeId: string) => void;
  readonly replacePrimaryAndCloseSecondary: (nodeId: string) => void;
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

  if (state.hasSecondary) {
    actions.replacePrimaryAndCloseSecondary(nodeId);
    return;
  }

  actions.openPrimary(nodeId);
}
