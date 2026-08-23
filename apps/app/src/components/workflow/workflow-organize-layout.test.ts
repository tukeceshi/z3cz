import { describe, expect, it } from "vitest";

import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";
import {
  computeLayoutComponentBounds,
  computeWorkflowOrganizeLayoutUpdates,
  groupNodesByConnectedComponent,
  normalizeLayoutOrigin,
  snapLayoutCoordinate,
  WORKFLOW_LAYOUT_COMPONENT_GAP_PX,
  WORKFLOW_LAYOUT_SNAP_GRID_PX,
} from "./workflow-organize-layout";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

function node(
  id: string,
  position: { x: number; y: number }
): ReactFlowNode<WorkflowNodeType> {
  return {
    id,
    position,
    data: { nodeType: "ai-image" } as WorkflowNodeType,
  } as ReactFlowNode<WorkflowNodeType>;
}

function edge(
  id: string,
  source: string,
  target: string
): ReactFlowEdge<WorkflowEdgeType> {
  return { id, source, target } as ReactFlowEdge<WorkflowEdgeType>;
}

describe("snapLayoutCoordinate", () => {
  it("snaps to the workflow grid", () => {
    expect(snapLayoutCoordinate(17)).toBe(12);
    expect(snapLayoutCoordinate(18)).toBe(24);
  });
});

describe("groupNodesByConnectedComponent", () => {
  it("splits disconnected node groups and preserves visual order", () => {
    const nodes = [
      node("a", { x: 0, y: 0 }),
      node("b", { x: 200, y: 0 }),
      node("c", { x: 0, y: 400 }),
    ];
    const edges = [edge("e1", "a", "b")];

    const components = groupNodesByConnectedComponent(nodes, edges);

    expect(components).toHaveLength(2);
    expect(components[0]?.map((item) => item.id)).toEqual(["a", "b"]);
    expect(components[1]?.map((item) => item.id)).toEqual(["c"]);
  });
});

describe("normalizeLayoutOrigin", () => {
  it("shifts positions so the top-left starts at zero", () => {
    const positions = new Map([
      ["a", { x: 120, y: 48 }],
      ["b", { x: 420, y: 96 }],
    ]);

    normalizeLayoutOrigin(positions);

    expect(positions.get("a")).toEqual({ x: 0, y: 0 });
    expect(positions.get("b")).toEqual({ x: 300, y: 48 });
  });
});

describe("computeLayoutComponentBounds", () => {
  it("returns the bounding box for a local component layout", () => {
    const positions = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 200, y: 100 }],
    ]);
    const dimensions = new Map([
      ["a", { width: 100, height: 80 }],
      ["b", { width: 120, height: 90 }],
    ]);

    expect(computeLayoutComponentBounds(positions, dimensions)).toEqual({
      width: 320,
      height: 190,
    });
  });
});

describe("computeWorkflowOrganizeLayoutUpdates", () => {
  it("lays out a simple chain left-to-right with layer spacing", async () => {
    const nodes = [
      node("a", { x: 50, y: 50 }),
      node("b", { x: 900, y: 300 }),
      node("c", { x: 1400, y: 700 }),
    ];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];
    const dimensions = new Map([
      ["a", { width: 200, height: 100 }],
      ["b", { width: 200, height: 100 }],
      ["c", { width: 200, height: 100 }],
    ]);

    const updates = await computeWorkflowOrganizeLayoutUpdates(
      nodes,
      edges,
      (layoutNode) => dimensions.get(layoutNode.id) ?? { width: 200, height: 100 }
    );

    const positions = new Map(
      nodes.map((layoutNode) => [layoutNode.id, { ...layoutNode.position }])
    );
    for (const update of updates) {
      positions.set(update.id, update.position);
    }

    const posA = positions.get("a")!;
    const posB = positions.get("b")!;
    const posC = positions.get("c")!;

    expect(posB.x).toBeGreaterThan(posA.x + 200);
    expect(posC.x).toBeGreaterThan(posB.x + 200);
    expect(posA.x % WORKFLOW_LAYOUT_SNAP_GRID_PX).toBe(0);
    expect(posA.y % WORKFLOW_LAYOUT_SNAP_GRID_PX).toBe(0);
  });

  it("keeps disconnected components separated", async () => {
    const nodes = [
      node("left-a", { x: 0, y: 0 }),
      node("left-b", { x: 500, y: 0 }),
      node("right-a", { x: 0, y: 500 }),
    ];
    const edges = [edge("e1", "left-a", "left-b")];
    const dimensions = new Map([
      ["left-a", { width: 200, height: 100 }],
      ["left-b", { width: 200, height: 100 }],
      ["right-a", { width: 200, height: 100 }],
    ]);

    const updates = await computeWorkflowOrganizeLayoutUpdates(
      nodes,
      edges,
      (layoutNode) => dimensions.get(layoutNode.id) ?? { width: 200, height: 100 }
    );

    const positions = new Map(
      nodes.map((layoutNode) => [layoutNode.id, { ...layoutNode.position }])
    );
    for (const update of updates) {
      positions.set(update.id, update.position);
    }

    const leftB = positions.get("left-b")!;
    const rightA = positions.get("right-a")!;

    expect(leftB.x - positions.get("left-a")!.x).toBeGreaterThan(200);
    expect(rightA.x - leftB.x).toBeGreaterThanOrEqual(
      WORKFLOW_LAYOUT_COMPONENT_GAP_PX
    );
  });
});
