import { describe, expect, it } from "vitest";

import { applyWorkflowNodeContentPatch } from "./apply-workflow-node-content-patch";
import type { WorkflowNodeType } from "./workflow-types";

function createImageNode(): WorkflowNodeType {
  return {
    name: "Image 1",
    nodeType: "ai-image",
    inputs: [
      {
        id: "images_result",
        name: "images_result",
        type: "json",
        hidden: true,
        value: [{ resourceId: "done-1", mimeType: "image/jpeg" }],
      },
      {
        id: "images_history",
        name: "images_history",
        type: "json",
        hidden: true,
        value: { items: [], selectedId: null },
      },
    ],
    outputs: [
      {
        id: "images",
        name: "images",
        type: "image",
        value: [{ resourceId: "done-1", mimeType: "image/jpeg" }],
      },
    ],
    executionState: "idle",
  };
}

describe("applyWorkflowNodeContentPatch", () => {
  it("replaces card media with the generating entry from the patch", () => {
    const current = createImageNode();
    const next = applyWorkflowNodeContentPatch(current, {
      inputs: {
        images_result: [
          { resourceId: "pending-1", mimeType: "image/png", generating: true },
        ],
        images_history: {
          selectedId: "gen-2",
          items: [
            {
              id: "gen-2",
              images: [
                {
                  resourceId: "pending-1",
                  mimeType: "image/png",
                  generating: true,
                },
              ],
            },
          ],
        },
      },
      outputs: {
        images: [
          { resourceId: "pending-1", mimeType: "image/png", generating: true },
        ],
      },
    });

    expect(next.inputs?.find((input) => input.id === "images_result")?.value).toEqual([
      { resourceId: "pending-1", mimeType: "image/png", generating: true },
    ]);
    expect(next.outputs?.find((output) => output.id === "images")?.value).toEqual([
      { resourceId: "pending-1", mimeType: "image/png", generating: true },
    ]);
    expect(
      next.inputs?.find((input) => input.id === "images_history")?.value
    ).toEqual({
      selectedId: "gen-2",
      items: [
        {
          id: "gen-2",
          images: [
            {
              resourceId: "pending-1",
              mimeType: "image/png",
              generating: true,
            },
          ],
        },
      ],
    });
  });

  it("applies ready media from the patch", () => {
    const current = createImageNode();
    const next = applyWorkflowNodeContentPatch(current, {
      inputs: {
        images_result: [{ resourceId: "done-2", mimeType: "image/png" }],
      },
    });

    expect(next.inputs?.find((input) => input.id === "images_result")?.value).toEqual([
      { resourceId: "done-2", mimeType: "image/png" },
    ]);
  });
});
