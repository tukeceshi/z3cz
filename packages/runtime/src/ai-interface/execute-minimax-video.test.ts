import { describe, expect, it, vi } from "vitest";

import { pollMinimaxVideoTask } from "./execute-minimax-video";

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
