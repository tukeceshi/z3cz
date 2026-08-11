import { describe, expect, it } from "vitest";

import type { WorkflowNodeType } from "./workflow-types";
import { readStudioModelLabel } from "./creative-studio-media-meta";

function createImageNode(model = "current-panel-model"): WorkflowNodeType {
  return {
    name: "Image 1",
    nodeType: "ai-image",
    inputs: [
      { id: "model", name: "model", type: "string", value: model },
      {
        id: "images_history",
        name: "images_history",
        type: "json",
        value: {
          selectedId: "gen-1",
          items: [
            {
              id: "gen-1",
              images: [],
              prompt: "prompt",
              platformModelId: "seed-3.0",
              providerModelId: "doubao-seed-3-0",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      },
    ],
    outputs: [{ id: "images", name: "images", type: "image", value: [] }],
    executionState: "idle",
  };
}

describe("readStudioModelLabel", () => {
  it("reads the current card model binding", () => {
    expect(readStudioModelLabel(createImageNode())).toBe("current-panel-model");
  });

  it("reads the current text card model binding", () => {
    const node: WorkflowNodeType = {
      name: "Text 1",
      nodeType: "ai-text",
      inputs: [
        { id: "model", name: "model", type: "string", value: "deepseek-v4-flash" },
        {
          id: "result_history",
          name: "result_history",
          type: "json",
          value: {
            selectedId: "gen-1",
            items: [
              {
                id: "gen-1",
                text: "hello",
                platformModelId: "seed-1.6",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        },
      ],
      outputs: [{ id: "text", name: "text", type: "string", value: "hello" }],
      executionState: "idle",
    };
    expect(readStudioModelLabel(node)).toBe("deepseek-v4-flash");
  });

  it("returns null when the card has no model binding", () => {
    const node = createImageNode("");
    node.inputs = node.inputs?.filter((input) => input.id !== "model") ?? [];
    expect(readStudioModelLabel(node)).toBeNull();
  });
});
