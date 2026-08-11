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
  secondaryNodeId: null,
};

const primaryOnly: StudioListEditorState = {
  hasPrimary: true,
  hasSecondary: false,
  primaryNodeId: "primary-1",
  secondaryNodeId: null,
};

const bothEditors: StudioListEditorState = {
  hasPrimary: true,
  hasSecondary: true,
  primaryNodeId: "primary-1",
  secondaryNodeId: "secondary-1",
};

function createActions(): StudioListNodeActions & {
  openPrimary: ReturnType<typeof vi.fn>;
  openSecondary: ReturnType<typeof vi.fn>;
  replacePrimary: ReturnType<typeof vi.fn>;
  promoteSecondaryToPrimary: ReturnType<typeof vi.fn>;
} {
  return {
    openPrimary: vi.fn(),
    openSecondary: vi.fn(),
    replacePrimary: vi.fn(),
    promoteSecondaryToPrimary: vi.fn(),
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

  it("replaces secondary when both editors are open", () => {
    const actions = createActions();
    handleStudioListNodeClick("node-b", bothEditors, actions);
    expect(actions.openSecondary).toHaveBeenCalledWith("node-b");
    expect(actions.openPrimary).not.toHaveBeenCalled();
  });

  it("ignores primary and secondary nodes when both editors are open", () => {
    const actions = createActions();
    handleStudioListNodeClick("primary-1", bothEditors, actions);
    handleStudioListNodeClick("secondary-1", bothEditors, actions);
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
    expect(actions.replacePrimary).toHaveBeenCalledWith("node-b");
  });

  it("replaces primary without closing secondary when both are open", () => {
    const actions = createActions();
    handleStudioListNodeDoubleClick("node-b", bothEditors, actions);
    expect(actions.replacePrimary).toHaveBeenCalledWith("node-b");
    expect(actions.promoteSecondaryToPrimary).not.toHaveBeenCalled();
  });

  it("promotes secondary to primary when double-clicking the secondary node", () => {
    const actions = createActions();
    handleStudioListNodeDoubleClick("secondary-1", bothEditors, actions);
    expect(actions.promoteSecondaryToPrimary).toHaveBeenCalledWith(
      "secondary-1"
    );
    expect(actions.replacePrimary).not.toHaveBeenCalled();
  });
});
