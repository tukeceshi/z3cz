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
  AI_TEXT_RESULT_HISTORY_INPUT_ID,
  AI_TEXT_RESULT_INPUT_ID,
} = await import("./ai-text-node-utils");
const {
  readAiTextGeneratingResourceId,
  withAiTextStagedGeneratedResult,
} = await import("./ai-text-persist-utils");

function createTextNode(history: unknown, result?: unknown): WorkflowNodeType {
  return {
    name: "文字 1",
    nodeType: "ai-text",
    inputs: [
      {
        id: AI_TEXT_RESULT_HISTORY_INPUT_ID,
        name: AI_TEXT_RESULT_HISTORY_INPUT_ID,
        type: "json",
        value: history,
      },
      ...(result
        ? [
            {
              id: AI_TEXT_RESULT_INPUT_ID,
              name: AI_TEXT_RESULT_INPUT_ID,
              type: "json" as const,
              value: result,
            },
          ]
        : []),
    ],
    outputs: [{ id: "text", name: "text", type: "string" }],
    executionState: "idle",
  };
}

describe("text generate resource id", () => {
  it("reads the placeholder id from a generating history row", () => {
    const node = createTextNode(
      {
        selectedId: "gen-1",
        items: [
          {
            id: "gen-1",
            resourceId: "text-res-1",
            createdAt: "2026-08-21T05:00:00.000Z",
            invocationId: "inv-1",
          },
        ],
      },
      {
        resourceId: "text-res-1",
        mimeType: "text/plain",
        generating: true,
      }
    );

    expect(readAiTextGeneratingResourceId(node.inputs)).toBe("text-res-1");
  });

  it("keeps the same resource id when generation finishes", () => {
    const generating = createTextNode(
      {
        selectedId: "gen-1",
        items: [
          {
            id: "gen-1",
            resourceId: "text-res-1",
            createdAt: "2026-08-21T05:00:00.000Z",
            invocationId: "inv-1",
          },
        ],
      },
      {
        resourceId: "text-res-1",
        mimeType: "text/plain",
        generating: true,
      }
    );

    const next = withAiTextStagedGeneratedResult(
      generating,
      {
        reference: {
          resourceId: "text-res-1",
          mimeType: "text/plain; charset=utf-8",
          contentSha256: "abc",
        },
        contentSha256: "abc",
        sessionText: "hello",
      },
      { platformModelId: "model-1" }
    );
    const history = (
      next.inputs?.find((input) => input.id === AI_TEXT_RESULT_HISTORY_INPUT_ID)
        ?.value ?? { items: [] }
    ) as { items: { resourceId?: string; contentSha256?: string }[] };
    const result = next.inputs?.find(
      (input) => input.id === AI_TEXT_RESULT_INPUT_ID
    )?.value;

    expect(history.items[0]?.resourceId).toBe("text-res-1");
    expect(history.items[0]?.contentSha256).toBe("abc");
    expect(result).toEqual({
      resourceId: "text-res-1",
      mimeType: "text/plain; charset=utf-8",
      contentSha256: "abc",
    });
    expect(readAiTextGeneratingResourceId(next.inputs ?? [])).toBeUndefined();
  });
});
