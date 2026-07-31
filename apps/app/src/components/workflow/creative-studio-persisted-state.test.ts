import { afterEach, describe, expect, it } from "vitest";

import {
  readCreativeStudioPersistedState,
  writeCreativeStudioPersistedState,
} from "./creative-studio-persisted-state";

const WORKFLOW_ID = "wf-test";

describe("creative-studio-persisted-state", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to canvas when nothing is stored", () => {
    expect(readCreativeStudioPersistedState(WORKFLOW_ID)).toEqual({
      viewMode: "canvas",
      nodeId: null,
      detailNodeId: null,
    });
  });

  it("round-trips studio view with node and detail ids", () => {
    writeCreativeStudioPersistedState(WORKFLOW_ID, {
      viewMode: "studio",
      nodeId: "node-1",
      detailNodeId: "node-1",
    });

    expect(readCreativeStudioPersistedState(WORKFLOW_ID)).toEqual({
      viewMode: "studio",
      nodeId: "node-1",
      detailNodeId: "node-1",
    });
  });

  it("clears node ids when view mode is canvas", () => {
    writeCreativeStudioPersistedState(WORKFLOW_ID, {
      viewMode: "canvas",
      nodeId: "node-1",
      detailNodeId: "node-1",
    });

    expect(readCreativeStudioPersistedState(WORKFLOW_ID)).toEqual({
      viewMode: "canvas",
      nodeId: null,
      detailNodeId: null,
    });
  });
});
