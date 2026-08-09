export interface StudioListNodeInteractionHandlers {
  readonly onListNodeClick: (nodeId: string) => void;
  readonly onListNodeDoubleClick: (nodeId: string) => void;
  readonly cancelPendingListClick: () => void;
}
