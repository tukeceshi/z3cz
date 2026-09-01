import { describe, expect, it } from "vitest";

import type { Node, WorkflowState } from "./workflow";
import {
  buildWorkflowPartialBroadcast,
  buildWorkflowUpdateIdentity,
  mergeWorkflowPartialState,
} from "./workflow-partial-update";

const baseNode = (id: string): Node => ({
  id,
  name: id,
  type: "ai.text",
  position: { x: 0, y: 0 },
  inputs: [{ name: "prompt", type: "string", value: "local prompt" }],
  outputs: [],
});

const baseState = (): WorkflowState => ({
  id: "wf-1",
  name: "Test",
  schemeId: "scheme",
  trigger: "manual",
  nodes: [baseNode("a")],
  edges: [],
  editorViewport: { x: 0, y: 0, zoom: 1 },
  generativeDefaults: {
    image: { canonicalId: "img-1", interfaceId: "iface-1" },
  },
  timestamp: 100,
});

describe("workflow-partial-update", () => {
  it("merges viewport-only updates without touching nodes", () => {
    const merged = mergeWorkflowPartialState(baseState(), {
      ...buildWorkflowUpdateIdentity(baseState()),
      timestamp: 200,
      editorViewport: { x: 10, y: 20, zoom: 1.5 },
    });

    expect(merged.timestamp).toBe(200);
    expect(merged.editorViewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
    expect(merged.nodes).toEqual(baseState().nodes);
    expect(merged.generativeDefaults).toEqual(baseState().generativeDefaults);
  });

  it("broadcasts only fields present in the inbound update", () => {
    const merged = mergeWorkflowPartialState(baseState(), {
      ...buildWorkflowUpdateIdentity(baseState()),
      timestamp: 200,
      editorViewport: { x: 10, y: 20, zoom: 1.5 },
    });

    const broadcast = buildWorkflowPartialBroadcast(merged, {
      ...buildWorkflowUpdateIdentity(baseState()),
      timestamp: 200,
      editorViewport: { x: 10, y: 20, zoom: 1.5 },
    });

    expect(broadcast).toEqual({
      id: "wf-1",
      name: "Test",
      trigger: "manual",
      timestamp: 200,
      editorViewport: { x: 10, y: 20, zoom: 1.5 },
    });
    expect("nodes" in broadcast).toBe(false);
    expect("edges" in broadcast).toBe(false);
  });

  it("still replaces graph when nodes and edges are included", () => {
    const nextNodes = [baseNode("b")];
    const merged = mergeWorkflowPartialState(baseState(), {
      ...buildWorkflowUpdateIdentity(baseState()),
      timestamp: 300,
      nodes: nextNodes,
      edges: [],
    });

    expect(merged.nodes).toEqual(nextNodes);
    expect(merged.timestamp).toBe(300);
  });
});
