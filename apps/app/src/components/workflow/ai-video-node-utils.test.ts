import { describe, expect, it } from "vitest";

import type { WorkflowNodeType } from "./workflow-types";

if (!("localStorage" in globalThis)) {
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    },
  });
}

const {
  AI_VIDEO_HISTORY_INPUT_ID,
  appendAiVideoGeneratedHistoryItems,
  readAiVideoGeneratingJobId,
  readAiVideoResultHistory,
} = await import("./ai-video-node-utils");

function createVideoNode(history: unknown): WorkflowNodeType {
  return {
    name: "Video 1",
    nodeType: "ai-video",
    inputs: [
      {
        id: AI_VIDEO_HISTORY_INPUT_ID,
        name: AI_VIDEO_HISTORY_INPUT_ID,
        type: "json",
        value: history,
      },
    ],
    outputs: [{ id: "videos", name: "videos", type: "video", value: [] }],
    executionState: "idle",
  };
}

describe("readAiVideoGeneratingJobId", () => {
  it("reads the job id from a generating history row", () => {
    const node = createVideoNode({
      selectedId: "gen-1",
      items: [
        {
          id: "gen-1",
          videos: [
            {
              resourceId: "res-1",
              mimeType: "video/mp4",
              generating: true,
            },
          ],
          prompt: "dance",
          createdAt: "2026-08-21T03:08:33.743Z",
          jobId: "job-1",
        },
      ],
    });

    expect(readAiVideoGeneratingJobId(node.inputs)).toBe("job-1");
  });

  it("keeps the same resource id when generation finishes", () => {
    const generating = createVideoNode({
      selectedId: "gen-1",
      items: [
        {
          id: "gen-1",
          videos: [
            {
              resourceId: "res-1",
              mimeType: "video/mp4",
              generating: true,
            },
          ],
          prompt: "dance",
          createdAt: "2026-08-21T03:08:33.743Z",
          jobId: "job-1",
        },
      ],
    });

    const next = appendAiVideoGeneratedHistoryItems(
      generating,
      [{ resourceId: "res-1", mimeType: "video/mp4" }],
      { prompt: "dance", jobId: "job-1" }
    );
    const history = readAiVideoResultHistory(next.inputs ?? generating.inputs);

    expect(history.items[0]?.videos[0]).toEqual({
      resourceId: "res-1",
      mimeType: "video/mp4",
    });
    expect(readAiVideoGeneratingJobId(next.inputs ?? [])).toBeUndefined();
  });
});
