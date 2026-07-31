export type WorkflowEditorViewMode = "canvas" | "studio";

const STORAGE_KEY_PREFIX = "dafthunk.workflow-editor.studio-state:";

export interface CreativeStudioPersistedState {
  readonly viewMode: WorkflowEditorViewMode;
  readonly nodeId: string | null;
  readonly detailNodeId: string | null;
}

const DEFAULT_STATE: CreativeStudioPersistedState = {
  viewMode: "canvas",
  nodeId: null,
  detailNodeId: null,
};

export function readCreativeStudioPersistedState(
  workflowId: string
): CreativeStudioPersistedState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${workflowId}`);
    if (!raw) {
      return DEFAULT_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<CreativeStudioPersistedState>;
    const viewMode = parsed.viewMode === "studio" ? "studio" : "canvas";
    if (viewMode !== "studio") {
      return DEFAULT_STATE;
    }

    const nodeId = typeof parsed.nodeId === "string" ? parsed.nodeId : null;
    const detailNodeId =
      typeof parsed.detailNodeId === "string" ? parsed.detailNodeId : null;

    return { viewMode, nodeId, detailNodeId };
  } catch {
    return DEFAULT_STATE;
  }
}

export function writeCreativeStudioPersistedState(
  workflowId: string,
  state: CreativeStudioPersistedState
): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${workflowId}`,
      JSON.stringify(state)
    );
  } catch {
    // ignore quota / private mode
  }
}
