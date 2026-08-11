import { describe, expect, it, vi } from "vitest";

import { AI_TEXT_OUTPUT_ID, AI_TEXT_RESULT_HISTORY_INPUT_ID, AI_TEXT_RESULT_INPUT_ID } from "./ai-text-node-utils";
import type { WorkflowNodeType } from "./workflow-types";
import {
  buildInlineAiTextFingerprint,
  nodeHasInlineAiText,
} from "./migrate-inline-ai-text";

vi.mock("@/services/ai-text-storage-service", () => ({
  stageAiTextContent: vi.fn(async () => ({
    kind: "local",
    mediaId: "media-1",
    mimeType: "text/plain",
  })),
}));

vi.mock("@/services/text-content-service", () => ({
  registerTextContent: vi.fn(),
  uploadTextContentBlob: vi.fn(),
}));

vi.mock("@/utils/text-content-utils", () => ({
  sha256HexFromText: vi.fn(async () => "abc123"),
}));

function createTextNode(overrides?: Partial<WorkflowNodeType>): WorkflowNodeType {
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

describe("migrate-inline-ai-text detection", () => {
  it("detects inline result text", () => {
    const node = createTextNode({
      inputs: [
        {
          id: AI_TEXT_RESULT_INPUT_ID,
          name: AI_TEXT_RESULT_INPUT_ID,
          type: "string",
          hidden: true,
          value: "hello world",
        },
      ],
    });

    expect(nodeHasInlineAiText(node)).toBe(true);
  });

  it("detects inline history text without resourceId", () => {
    const node = createTextNode({
      inputs: [
        {
          id: AI_TEXT_RESULT_HISTORY_INPUT_ID,
          name: AI_TEXT_RESULT_HISTORY_INPUT_ID,
          type: "json",
          hidden: true,
          value: {
            items: [{ id: "gen-1", text: "history body", createdAt: "2026-01-01" }],
            selectedId: "gen-1",
          },
        },
      ],
    });

    expect(nodeHasInlineAiText(node)).toBe(true);
  });

  it("ignores staged resource references", () => {
    const node = createTextNode({
      inputs: [
        {
          id: AI_TEXT_RESULT_INPUT_ID,
          name: AI_TEXT_RESULT_INPUT_ID,
          type: "json",
          hidden: true,
          value: { kind: "local", mediaId: "media-1", mimeType: "text/plain" },
        },
      ],
    });

    expect(nodeHasInlineAiText(node)).toBe(false);
  });
});

describe("buildInlineAiTextFingerprint", () => {
  it("changes when inline text is present", () => {
    const inline = [
      {
        id: "n1",
        data: createTextNode({
          inputs: [
            {
              id: AI_TEXT_RESULT_INPUT_ID,
              name: AI_TEXT_RESULT_INPUT_ID,
              type: "string",
              hidden: true,
              value: "inline",
            },
          ],
        }),
      },
    ];
    const staged = [
      {
        id: "n1",
        data: createTextNode({
          inputs: [
            {
              id: AI_TEXT_RESULT_INPUT_ID,
              name: AI_TEXT_RESULT_INPUT_ID,
              type: "json",
              hidden: true,
              value: { kind: "local", mediaId: "m1", mimeType: "text/plain" },
            },
          ],
        }),
      },
    ];

    expect(buildInlineAiTextFingerprint(inline)).not.toBe(
      buildInlineAiTextFingerprint(staged)
    );
  });
});
