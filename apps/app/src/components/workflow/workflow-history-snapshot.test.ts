import { describe, expect, it } from "vitest";

import {
  computeRemovedNodeIds,
  restoreCanvasJson,
} from "@/components/workflow/workflow-history-snapshot";
import type { WorkflowNodeType } from "@/components/workflow/workflow-types";

describe("workflow-history-snapshot", () => {
  it("computes removed node ids between snapshots", () => {
    const removed = computeRemovedNodeIds(
      [
        {
          id: "a",
          type: "workflowNode",
          position: { x: 0, y: 0 },
          data: { id: "a", name: "A", inputs: [], outputs: [] } as WorkflowNodeType,
        },
        {
          id: "b",
          type: "workflowNode",
          position: { x: 0, y: 0 },
          data: { id: "b", name: "B", inputs: [], outputs: [] } as WorkflowNodeType,
        },
      ],
      {
        nodes: [
          {
            id: "a",
            name: "A",
            type: "default",
            position: { x: 0, y: 0 },
            inputs: [],
            outputs: [],
          },
        ],
        edges: [],
      }
    );

    expect(removed).toEqual(["b"]);
  });

  it("keeps live node data when restoring an existing node", () => {
    const liveInputs = [
      {
        id: "images_history",
        name: "history",
        type: "json" as const,
        value: { items: [{ id: "gen-1" }], selectedId: "gen-1" },
      },
    ];

    const restored = restoreCanvasJson({
      snapshot: {
        nodes: [
          {
            id: "img-1",
            name: "Image",
            type: "ai-image",
            position: { x: 120, y: 40 },
            inputs: [],
            outputs: [],
          },
        ],
        edges: [],
      },
      currentNodes: [
        {
          id: "img-1",
          type: "workflowNode",
          position: { x: 0, y: 0 },
          data: {
            id: "img-1",
            name: "Image",
            nodeType: "ai-image",
            inputs: liveInputs,
            outputs: [],
          } as WorkflowNodeType,
        },
      ],
      nodeTypes: [],
      createObjectUrl: () => "blob:mock",
    });

    expect(restored.nodes[0]?.position).toEqual({ x: 120, y: 40 });
    expect(restored.nodes[0]?.data.inputs).toBe(liveInputs);
  });
});
