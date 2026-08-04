const STORAGE_KEY_PREFIX = "dafthunk.workflow-editor.agent-sidebar:";

const MIN_SIDEBAR_WIDTH = 320;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_SIDEBAR_WIDTH = 384;

export interface AgentSidebarPersistedState {
  readonly visible: boolean;
  readonly width: number;
}

function clampSidebarWidth(width: number): number {
  return Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
}

export function readAgentSidebarPersistedState(
  workflowId: string
): AgentSidebarPersistedState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${workflowId}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AgentSidebarPersistedState>;
    const visible = parsed.visible === true;
    const width =
      typeof parsed.width === "number" && Number.isFinite(parsed.width)
        ? clampSidebarWidth(parsed.width)
        : DEFAULT_SIDEBAR_WIDTH;

    return { visible, width };
  } catch {
    return null;
  }
}

export function writeAgentSidebarPersistedState(
  workflowId: string,
  state: AgentSidebarPersistedState
): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${workflowId}`,
      JSON.stringify({
        visible: state.visible,
        width: clampSidebarWidth(state.width),
      })
    );
  } catch {
    // ignore quota / private mode
  }
}
