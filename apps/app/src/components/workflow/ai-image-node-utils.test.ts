import { describe, expect, it } from "vitest";

import {
  readAiImageCardImages,
  readAiImageGeneratingJobId,
  readAiImageResultHistory,
  withAiImageGeneratedResult,
  withAiImageGeneratingHistory,
  withAiImageGeneratingHistoryFailed,
} from "./ai-image-node-utils";
import type { WorkflowNodeType } from "./workflow-types";

function createImageNode(): WorkflowNodeType {
  return {
    name: "Image 1",
    nodeType: "ai-image",
    inputs: [],
    outputs: [{ id: "images", name: "images", type: "image", value: [] }],
    executionState: "idle",
  };
}

describe("withAiImageGeneratingHistory", () => {
  it("appends a generating history row and selects it", () => {
    const current = createImageNode();
    const withSuccess = withAiImageGeneratedResult(
      current,
      [{ resourceId: "done-1", mimeType: "image/jpeg" }],
      { prompt: "first" }
    );
    const working = { ...current, ...withSuccess } as WorkflowNodeType;

    const update = withAiImageGeneratingHistory(working, {
      resourceIds: ["pending-1"],
      prompt: "second",
      jobId: "job-2",
    });
    const history = readAiImageResultHistory(update.inputs ?? working.inputs);

    expect(history.items).toHaveLength(2);
    expect(history.items[0]?.images[0]).toEqual({
      resourceId: "pending-1",
      mimeType: "image/png",
      generating: true,
    });
    expect(history.items[0]?.jobId).toBe("job-2");
    expect(history.selectedId).toBe(history.items[0]?.id);
    expect(readAiImageGeneratingJobId(update.inputs ?? [])).toBe("job-2");
  });
});

describe("withAiImageGeneratedResult", () => {
  it("updates the same generating history row instead of appending", () => {
    const current = createImageNode();
    const pending = withAiImageGeneratingHistory(current, {
      resourceIds: ["pending-1"],
      prompt: "second",
      jobId: "job-2",
    });
    const working = { ...current, ...pending } as WorkflowNodeType;
    const pendingHistory = readAiImageResultHistory(working.inputs);
    const pendingId = pendingHistory.selectedId;

    const completed = withAiImageGeneratedResult(
      working,
      [{ resourceId: "done-2", mimeType: "image/jpeg" }],
      { prompt: "second", jobId: "job-2" }
    );
    const history = readAiImageResultHistory(completed.inputs ?? working.inputs);

    expect(history.items).toHaveLength(1);
    expect(history.selectedId).toBe(pendingId);
    expect(history.items[0]?.id).toBe(pendingId);
    expect(history.items[0]?.images[0]).toEqual({
      resourceId: "done-2",
      mimeType: "image/jpeg",
    });
    expect(history.items[0]?.jobId).toBeUndefined();
  });
});

describe("readAiImageCardImages", () => {
  it("prefers selected history media over stale images_result", () => {
    const node = createImageNode();
    node.inputs = [
      {
        id: "images_result",
        name: "images_result",
        type: "json",
        hidden: true,
        value: [{ resourceId: "old-done", mimeType: "image/jpeg" }],
      },
      {
        id: "images_history",
        name: "images_history",
        type: "json",
        hidden: true,
        value: {
          selectedId: "gen-1",
          items: [
            {
              id: "gen-1",
              images: [
                {
                  resourceId: "pending-1",
                  mimeType: "image/png",
                  generating: true,
                },
              ],
              prompt: "",
              createdAt: "2026-01-01T00:00:00.000Z",
              jobId: "job-1",
            },
          ],
        },
      },
    ];

    expect(readAiImageCardImages(node.inputs, node.outputs)).toEqual([
      {
        resourceId: "pending-1",
        mimeType: "image/png",
        generating: true,
      },
    ]);
  });

  it("keeps the last ready image while selected history is generating", () => {
    const node = createImageNode();
    node.inputs = [
      {
        id: "images_result",
        name: "images_result",
        type: "json",
        hidden: true,
        value: [
          {
            resourceId: "pending-1",
            mimeType: "image/png",
            generating: true,
          },
        ],
      },
      {
        id: "images_history",
        name: "images_history",
        type: "json",
        hidden: true,
        value: {
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
              prompt: "",
              createdAt: "2026-01-02T00:00:00.000Z",
              jobId: "job-2",
            },
            {
              id: "gen-1",
              images: [{ resourceId: "done-1", mimeType: "image/jpeg" }],
              prompt: "",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      },
    ];

    expect(readAiImageCardImages(node.inputs, node.outputs)).toEqual([
      { resourceId: "done-1", mimeType: "image/jpeg" },
    ]);
  });
});

describe("withAiImageGeneratingHistoryFailed", () => {
  it("keeps the resource id and job id, marked failed", () => {
    const current = createImageNode();
    const pending = withAiImageGeneratingHistory(current, {
      resourceIds: ["pending-1"],
      prompt: "second",
      jobId: "job-2",
    });
    const working = { ...current, ...pending } as WorkflowNodeType;
    const failed = withAiImageGeneratingHistoryFailed(working, "job-2");
    const history = readAiImageResultHistory(failed.inputs ?? working.inputs);

    expect(history.items).toHaveLength(1);
    expect(history.items[0]?.images[0]).toEqual({
      resourceId: "pending-1",
      mimeType: "image/png",
      failed: true,
    });
    expect(history.items[0]?.jobId).toBe("job-2");
  });
});
