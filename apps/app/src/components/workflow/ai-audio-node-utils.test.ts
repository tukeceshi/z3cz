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
  AI_AUDIO_HISTORY_INPUT_ID,
  appendAiAudioGeneratedHistoryItems,
  readAiAudioGeneratingJobId,
  readAiAudioResultHistory,
} = await import("./ai-audio-node-utils");

function createAudioNode(history: unknown): WorkflowNodeType {
  return {
    name: "Audio 1",
    nodeType: "ai-audio",
    inputs: [
      {
        id: AI_AUDIO_HISTORY_INPUT_ID,
        name: AI_AUDIO_HISTORY_INPUT_ID,
        type: "json",
        value: history,
      },
    ],
    outputs: [{ id: "audios", name: "audios", type: "audio", value: [] }],
    executionState: "idle",
  };
}

describe("readAiAudioGeneratingJobId", () => {
  it("reads the job id from a generating history row", () => {
    const node = createAudioNode({
      selectedId: "gen-1",
      items: [
        {
          id: "gen-1",
          audios: [
            {
              resourceId: "res-1",
              mimeType: "audio/mpeg",
              generating: true,
            },
          ],
          prompt: "hello",
          createdAt: "2026-08-21T03:08:33.743Z",
          jobId: "job-1",
        },
      ],
    });

    expect(readAiAudioGeneratingJobId(node.inputs)).toBe("job-1");
  });

  it("keeps the same resource id when generation finishes", () => {
    const generating = createAudioNode({
      selectedId: "gen-1",
      items: [
        {
          id: "gen-1",
          audios: [
            {
              resourceId: "res-1",
              mimeType: "audio/mpeg",
              generating: true,
            },
          ],
          prompt: "hello",
          createdAt: "2026-08-21T03:08:33.743Z",
          jobId: "job-1",
        },
      ],
    });

    const next = appendAiAudioGeneratedHistoryItems(
      generating,
      [{ resourceId: "res-1", mimeType: "audio/mpeg" }],
      { prompt: "hello", jobId: "job-1" }
    );
    const history = readAiAudioResultHistory(next.inputs ?? generating.inputs);

    expect(history.items[0]?.audios[0]).toEqual({
      resourceId: "res-1",
      mimeType: "audio/mpeg",
    });
    expect(readAiAudioGeneratingJobId(next.inputs ?? [])).toBeUndefined();
  });
});
