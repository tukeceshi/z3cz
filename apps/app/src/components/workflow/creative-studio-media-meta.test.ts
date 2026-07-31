import { describe, expect, it } from "vitest";

import type { WorkflowNodeType } from "./workflow-types";
import { readStudioModelLabel } from "./creative-studio-media-meta";

function createImageNode(): WorkflowNodeType {
  return {
    name: "Image 1",
    nodeType: "ai-image",
    inputs: [
      { id: "model", name: "model", type: "string", value: "current-panel-model" },
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
  it("reads the selected history item's platform model id", () => {
    expect(readStudioModelLabel(createImageNode())).toBe("seed-3.0");
  });

  it("reads the selected text history item's platform model id", () => {
    const node: WorkflowNodeType = {
      name: "Text 1",
      nodeType: "ai-text",
      inputs: [
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
    expect(readStudioModelLabel(node)).toBe("seed-1.6");
  });

  it("does not fall back to the current panel model input", () => {
    const node = createImageNode();
    node.inputs = [{ id: "model", name: "model", type: "string", value: "current-panel-model" }];
    expect(readStudioModelLabel(node)).toBeNull();
  });
});
