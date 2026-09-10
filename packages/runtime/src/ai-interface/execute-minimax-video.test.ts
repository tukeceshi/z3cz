import { DEFAULT_VIDEO_MODEL_PARAMETER_RULES } from "@dafthunk/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  pollMinimaxVideoTask,
  submitMinimaxVideoTask,
} from "./execute-minimax-video";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitMinimaxVideoTask", () => {
  it("reads task_id from the official create response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ task_id: "2097927490929795072" }), {
        status: 200,
      })
    );

    const result = await submitMinimaxVideoTask({
      apiKey: "test-key",
      baseUrl: "https://api.minimaxi.com",
      providerModelId: "MiniMax-H3",
      prompt: "A cinematic sunset",
      parameterRules: DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
    });

    expect(result).toEqual({
      status: "submitted",
      taskId: "2097927490929795072",
      pollUrl:
        "https://api.minimaxi.com/v2/query/video_generation/2097927490929795072",
    });
  });

  it("falls back to task.id when task_id is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ task: { id: "2092606496913080320" } }), {
        status: 200,
      })
    );

    const result = await submitMinimaxVideoTask({
      apiKey: "test-key",
      baseUrl: "https://api.minimaxi.com",
      providerModelId: "MiniMax-H3",
      prompt: "A cinematic sunset",
      parameterRules: DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
    });

    expect(result).toEqual({
      status: "submitted",
      taskId: "2092606496913080320",
      pollUrl:
        "https://api.minimaxi.com/v2/query/video_generation/2092606496913080320",
    });
  });
});

describe("pollMinimaxVideoTask", () => {
  it("returns completed when task.status is succeeded and content.url is present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          task: {
            id: "2092606496913080320",
            status: "succeeded",
            content: {
              url: "https://files.example.com/video.mp4",
            },
          },
        }),
        { status: 200 }
      )
    );

    const result = await pollMinimaxVideoTask({
      apiKey: "test-key",
      pollUrl: "https://example.com/v2/query/video_generation/2092606496913080320",
    });

    expect(result).toEqual({
      status: "completed",
      videoUrl: "https://files.example.com/video.mp4",
    });
  });

  it("returns pending when task.status is running", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          task: {
            id: "2092606496913080320",
            status: "running",
          },
        }),
        { status: 200 }
      )
    );

    const result = await pollMinimaxVideoTask({
      apiKey: "test-key",
      pollUrl: "https://example.com/v2/query/video_generation/2092606496913080320",
    });

    expect(result).toEqual({
      status: "pending",
      upstreamPhase: "running",
    });
  });
});
