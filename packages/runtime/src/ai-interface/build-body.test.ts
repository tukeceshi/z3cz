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
});
