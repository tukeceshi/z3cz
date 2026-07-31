import type { ObjectReference } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  appendAiVideoGeneratedHistoryItems,
  readAiVideoResultHistory,
} from "./ai-video-node-utils";
import type { WorkflowNodeType } from "./workflow-types";

function createVideoNode(): WorkflowNodeType {
  return {
    name: "Video 1",
    nodeType: "ai-video",
    inputs: [],
    outputs: [{ id: "videos", name: "videos", type: "video", value: [] }],
    executionState: "idle",
  };
}

function objectRef(id: string): ObjectReference {
  return { id, mimeType: "video/mp4" };
}

describe("appendAiVideoGeneratedHistoryItems", () => {
  it("appends one history item for a multi-video batch", () => {
    const current = createVideoNode();
    const videos = [objectRef("a"), objectRef("b"), objectRef("c")];

    const update = appendAiVideoGeneratedHistoryItems(current, videos, {
      prompt: "batch prompt",
      platformModelId: "seed-1.6",
      providerModelId: "doubao-seed-1-6-250615",
    });

    const inputs = update.inputs ?? current.inputs;
    const history = readAiVideoResultHistory(inputs);

    expect(history.items).toHaveLength(1);
    expect(history.items[0]?.videos).toHaveLength(3);
    expect(history.items[0]?.prompt).toBe("batch prompt");
    expect(history.items[0]?.platformModelId).toBe("seed-1.6");
    expect(history.items[0]?.providerModelId).toBe("doubao-seed-1-6-250615");
    expect(history.selectedId).toBe(history.items[0]?.id);

    const resultInput = inputs.find((input) => input.id === "videos_result");
    expect(resultInput?.value).toEqual([videos[0]]);
  });
});
