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
  it("appends one history item per video in a batch", () => {
    const current = createVideoNode();
    const videos = [objectRef("a"), objectRef("b"), objectRef("c")];

    const update = appendAiVideoGeneratedHistoryItems(current, videos, {
      prompt: "batch prompt",
      platformModelId: "seed-1.6",
      providerModelId: "doubao-seed-1-6-250615",
      modelDisplayName: "Seed 1.6",
    });

    const inputs = update.inputs ?? current.inputs;
    const history = readAiVideoResultHistory(inputs);

    expect(history.items).toHaveLength(3);
    expect(history.items.every((item) => item.videos.length === 1)).toBe(true);
    expect(history.items.map((item) => item.videos[0])).toEqual(videos);
    expect(history.items[0]?.prompt).toBe("batch prompt");
    expect(history.items[0]?.platformModelId).toBe("seed-1.6");
    expect(history.items[0]?.providerModelId).toBe("doubao-seed-1-6-250615");
    expect(history.items[0]?.modelDisplayName).toBe("Seed 1.6");
    expect(history.selectedId).toBe(history.items[0]?.id);

    const resultInput = inputs.find((input) => input.id === "videos_result");
    expect(resultInput?.value).toEqual([videos[0]]);
  });

  it("splits legacy multi-video history rows on read", () => {
    const current = createVideoNode();
    const videos = [objectRef("a"), objectRef("b")];
    const seeded = {
      ...current,
      inputs: [
        {
          id: "videos_history",
          name: "videos_history",
          type: "json" as const,
          value: {
            selectedId: "legacy-1",
            items: [
              {
                id: "legacy-1",
                videos,
                prompt: "old",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        },
      ],
    };

    const history = readAiVideoResultHistory(seeded.inputs);
    expect(history.items).toHaveLength(2);
    expect(history.items[0]?.id).toBe("legacy-1");
    expect(history.items[1]?.id).toBe("legacy-1-1");
    expect(history.items[0]?.videos).toEqual([videos[0]]);
    expect(history.items[1]?.videos).toEqual([videos[1]]);
  });
});
