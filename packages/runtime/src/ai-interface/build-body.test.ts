import { describe, expect, it } from "vitest";

import { buildBodyFromSlots } from "./build-body";

describe("buildBodyFromSlots openai-messages", () => {
  it("sends a conversation history when messages are provided", () => {
    const body = buildBodyFromSlots({
      slots: [{ kind: "openai-messages", to: "messages", promptField: "prompt" }],
      inputs: {
        messages: [
          { role: "user", content: "hello" },
          { role: "assistant", content: "hi" },
          { role: "user", content: "again" },
        ],
      },
      model: "demo",
      fields: [],
    });

    expect(body).toEqual({
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "user", content: "again" },
      ],
    });
  });

  it("falls back to a single prompt when messages are absent", () => {
    const body = buildBodyFromSlots({
      slots: [{ kind: "openai-messages", to: "messages", promptField: "prompt" }],
      inputs: { prompt: "only prompt" },
      model: "demo",
      fields: [],
    });

    expect(body).toEqual({
      messages: [{ role: "user", content: "only prompt" }],
    });
  });

  it("keeps empty assistant content when tool_calls are present", () => {
    const body = buildBodyFromSlots({
      slots: [{ kind: "openai-messages", to: "messages", promptField: "prompt" }],
      inputs: {
        messages: [
          { role: "user", content: "看画布" },
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "call-1",
                name: "canvas_get_state",
                arguments: "",
              },
            ],
          },
          {
            role: "tool",
            toolCallId: "call-1",
            content: '{"nodes":[]}',
          },
        ],
      },
      model: "demo",
      fields: [],
    });

    expect(body).toEqual({
      messages: [
        { role: "user", content: "看画布" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call-1",
              type: "function",
              function: { name: "canvas_get_state", arguments: "" },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "call-1",
          content: '{"nodes":[]}',
        },
      ],
    });
  });
});
