import { describe, expect, it } from "vitest";

import {
  applyWorkflowGraphPatch,
  diffWorkflowGraph,
} from "./workflow-graph-patch";
import type { Node, WorkflowState } from "./workflow";

const baseNode = (id: string, x: number): Node => ({
  id,
  name: id,
  type: "ai.text",
  position: { x, y: 0 },
  inputs: [],
  outputs: [],
});

const baseState = (nodes: Node[]): WorkflowState => ({
  id: "wf-1",
  name: "Test",
  schemeId: "scheme",
  trigger: "manual",
  nodes,
  edges: [],
  timestamp: 1,
});

describe("workflow-graph-patch", () => {
  it("diffs position-only changes as position patches", () => {
    const previous = {
      nodes: [baseNode("a", 0)],
      edges: [],
    };
    const next = {
      nodes: [{ ...baseNode("a", 10), name: "a" }],
      edges: [],
    };

    const patch = diffWorkflowGraph(previous, next);
    expect(patch.nodePatches).toEqual([
      { type: "position", id: "a", position: { x: 10, y: 0 } },
    ]);
  });

  it("applies add/remove node patches and drops dangling edges", () => {
    const state = baseState([baseNode("a", 0)]);
    state.edges = [
      { source: "a", target: "b", sourceOutput: "out", targetInput: "in" },
    ];

    const patched = applyWorkflowGraphPatch(state, {
      nodePatches: [{ type: "remove", id: "a" }],
      edgePatches: [],
    });

    expect(patched.nodes).toEqual([]);
    expect(patched.edges).toEqual([]);
  });
});
