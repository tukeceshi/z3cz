import { describe, expect, it, vi } from "vitest";

import {
  handleStudioListNodeClick,
  handleStudioListNodeDoubleClick,
  type StudioListEditorState,
  type StudioListNodeActions,
} from "./studio-list-node-interaction";

const noEditors: StudioListEditorState = {
  hasPrimary: false,
  hasSecondary: false,
  primaryNodeId: null,
};

const primaryOnly: StudioListEditorState = {
  hasPrimary: true,
  hasSecondary: false,
  primaryNodeId: "primary-1",
};

const bothEditors: StudioListEditorState = {
  hasPrimary: true,
  hasSecondary: true,
  primaryNodeId: "primary-1",
};

function createActions(): StudioListNodeActions & {
  openPrimary: ReturnType<typeof vi.fn>;
  openSecondary: ReturnType<typeof vi.fn>;
  replacePrimaryAndCloseSecondary: ReturnType<typeof vi.fn>;
} {
  return {
    openPrimary: vi.fn(),
    openSecondary: vi.fn(),
    replacePrimaryAndCloseSecondary: vi.fn(),
  };
}

describe("handleStudioListNodeClick", () => {
  it("opens primary when no editor is open", () => {
    const actions = createActions();
    handleStudioListNodeClick("node-a", noEditors, actions);
    expect(actions.openPrimary).toHaveBeenCalledWith("node-a");
  });

  it("opens secondary when only primary is open", () => {
    const actions = createActions();
    handleStudioListNodeClick("node-b", primaryOnly, actions);
    expect(actions.openSecondary).toHaveBeenCalledWith("node-b");
  });

  it("ignores duplicate primary node", () => {
    const actions = createActions();
    handleStudioListNodeClick("primary-1", primaryOnly, actions);
    expect(actions.openSecondary).not.toHaveBeenCalled();
  });

  it("does nothing when both editors are open", () => {
    const actions = createActions();
    handleStudioListNodeClick("node-b", bothEditors, actions);
    expect(actions.openPrimary).not.toHaveBeenCalled();
    expect(actions.openSecondary).not.toHaveBeenCalled();
  });
});

describe("handleStudioListNodeDoubleClick", () => {
  it("opens primary when no editor is open", () => {
    const actions = createActions();
    handleStudioListNodeDoubleClick("node-a", noEditors, actions);
    expect(actions.openPrimary).toHaveBeenCalledWith("node-a");
  });

  it("switches primary when only primary is open", () => {
    const actions = createActions();
    handleStudioListNodeDoubleClick("node-b", primaryOnly, actions);
    expect(actions.openPrimary).toHaveBeenCalledWith("node-b");
  });

  it("replaces primary and closes secondary when both are open", () => {
    const actions = createActions();
    handleStudioListNodeDoubleClick("node-b", bothEditors, actions);
    expect(actions.replacePrimaryAndCloseSecondary).toHaveBeenCalledWith("node-b");
  });
});
