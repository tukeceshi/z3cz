import { afterEach, describe, expect, it } from "vitest";

import {
  readAgentSidebarPersistedState,
  writeAgentSidebarPersistedState,
} from "./workflow-agent-sidebar-persisted-state";

const WORKFLOW_ID = "wf-test";

describe("workflow-agent-sidebar-persisted-state", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(readAgentSidebarPersistedState(WORKFLOW_ID)).toBeNull();
  });

  it("round-trips visible state and width", () => {
    writeAgentSidebarPersistedState(WORKFLOW_ID, {
      visible: true,
      width: 420,
    });

    expect(readAgentSidebarPersistedState(WORKFLOW_ID)).toEqual({
      visible: true,
      width: 420,
    });
  });

  it("clamps stored width to supported bounds", () => {
    writeAgentSidebarPersistedState(WORKFLOW_ID, {
      visible: false,
      width: 999,
    });

    expect(readAgentSidebarPersistedState(WORKFLOW_ID)).toEqual({
      visible: false,
      width: 800,
    });
  });
});
