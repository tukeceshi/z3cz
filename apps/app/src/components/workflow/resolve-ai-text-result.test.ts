import { describe, expect, it, vi } from "vitest";

import {
  AI_TEXT_OUTPUT_ID,
  AI_TEXT_RESULT_INPUT_ID,
  readAiTextResultTextSync,
} from "./ai-text-node-utils";
import { resolveAiTextResultText } from "./resolve-ai-text-result";
import type { WorkflowNodeType } from "./workflow-types";

vi.mock("@/services/ai-text-storage-service", () => ({
  readAiTextContent: vi.fn(),
}));

import { readAiTextContent } from "@/services/ai-text-storage-service";

function createTextNode(
  overrides?: Partial<WorkflowNodeType>
): WorkflowNodeType {
  return {
    id: "node-1",
    type: "workflowNode",
    name: "AI Text",
    nodeType: "ai-text",
    position: { x: 0, y: 0 },
    inputs: [],
    outputs: [{ id: AI_TEXT_OUTPUT_ID, name: "text", type: "string", value: "" }],
    metadata: undefined,
    ...overrides,
  };
}

describe("resolve-ai-text-result", () => {
  it("reads session output text and ignores the generation prompt input", () => {
    const node = createTextNode({
      inputs: [
        { id: "prompt", name: "prompt", type: "string", value: "generate me a poem" },
        {
          id: AI_TEXT_RESULT_INPUT_ID,
          name: AI_TEXT_RESULT_INPUT_ID,
          type: "json",
          value: {
            resourceId: "res-1",
            contentSha256: "abc",
            mimeType: "text/plain; charset=utf-8",
          },
        },
      ],
      outputs: [
        {
          id: AI_TEXT_OUTPUT_ID,
          name: "text",
          type: "string",
          value: "  final poem  ",
        },
      ],
    });

    expect(readAiTextResultTextSync(node)).toBe("final poem");
  });

  it("loads external result bodies when session text is empty", async () => {
    vi.mocked(readAiTextContent).mockResolvedValue("stored body");

    const node = createTextNode({
      inputs: [
        { id: "prompt", name: "prompt", type: "string", value: "only a prompt" },
        {
          id: AI_TEXT_RESULT_INPUT_ID,
          name: AI_TEXT_RESULT_INPUT_ID,
          type: "json",
          value: {
            resourceId: "res-1",
            contentSha256: "abc",
            mimeType: "text/plain; charset=utf-8",
          },
        },
      ],
    });

    await expect(
      resolveAiTextResultText({
        organizationId: "org-1",
        workflowId: "wf-1",
        data: node,
      })
    ).resolves.toBe("stored body");
  });
});
