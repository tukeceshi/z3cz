import { describe, expect, it } from "vitest";

import type { WorkflowNodeType } from "./workflow-types";
import type { NodeType } from "./workflow-types";
import {
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_OUTPUT_ID,
  AI_TEXT_RESULT_HISTORY_INPUT_ID,
  AI_TEXT_RESULT_INPUT_ID,
  hasAiTextGeneratedHistory,
  mergeAiTextNodeCatalogInputs,
  readAiTextResultHistory,
  withAiTextEditedResult,
  withAiTextGeneratedResult,
  withAiTextManualResult,
} from "./ai-text-node-utils";
import { isGenerativeManualContent } from "./generative-card-mode-utils";

function createTextNode(): WorkflowNodeType {
  return {
    id: "node-1",
    type: "workflowNode",
    name: "AI Text",
    nodeType: "ai-text",
    position: { x: 0, y: 0 },
    inputs: [],
    outputs: [{ id: AI_TEXT_OUTPUT_ID, name: "text", type: "string", value: "" }],
    metadata: undefined,
  };
}

describe("mergeAiTextNodeCatalogInputs", () => {
  const catalog = {
    type: "ai-text",
    inputs: [
      { name: "prompt", type: "string", hidden: true },
      { name: "result", type: "string", hidden: true },
    ],
  } as NodeType;

  it("always includes keywords input for new ai-text nodes", () => {
    const merged = mergeAiTextNodeCatalogInputs("ai-text", [], catalog);
    const keywords = merged.find((input) => input.id === AI_TEXT_KEYWORDS_HANDLE_ID);
    expect(keywords).toMatchObject({
      id: AI_TEXT_KEYWORDS_HANDLE_ID,
      type: "any",
      hidden: true,
      repeated: true,
    });
    expect(keywords?.value).toBeUndefined();
  });

  it("does not duplicate keywords when catalog already defines it", () => {
    const merged = mergeAiTextNodeCatalogInputs(
      "ai-text",
      [{ id: AI_TEXT_KEYWORDS_HANDLE_ID, name: AI_TEXT_KEYWORDS_HANDLE_ID, type: "any" }],
      {
        ...catalog,
        inputs: [
          ...catalog.inputs,
          { name: AI_TEXT_KEYWORDS_HANDLE_ID, type: "any", hidden: true, repeated: true },
        ],
      }
    );
    expect(
      merged.filter((input) => input.id === AI_TEXT_KEYWORDS_HANDLE_ID)
    ).toHaveLength(1);
  });
});

describe("ai-text-node-utils editing behavior", () => {
  it("marks direct manual text as manual content", () => {
    const result = withAiTextManualResult(createTextNode(), "manual text");
    expect(isGenerativeManualContent(result.metadata)).toBe(true);
  });

  it("preserves generated mode and history when editing AI output", () => {
    const generatedNode = {
      ...createTextNode(),
      ...withAiTextGeneratedResult(createTextNode(), "generated text", {
        platformModelId: "seed-3.0",
        providerModelId: "doubao-seed-3-0",
      }),
    } as WorkflowNodeType;

    expect(hasAiTextGeneratedHistory(generatedNode.inputs)).toBe(true);

    const edited = withAiTextEditedResult(generatedNode, "edited generated text");
    const nextNode = { ...generatedNode, ...edited } as WorkflowNodeType;
    const history = readAiTextResultHistory(nextNode.inputs);

    expect(isGenerativeManualContent(nextNode.metadata)).toBe(false);
    expect(history.items[0]?.text).toBe("edited generated text");
    expect(history.items[0]?.platformModelId).toBe("seed-3.0");
    expect(history.items[0]?.providerModelId).toBe("doubao-seed-3-0");
    expect(
      nextNode.inputs.find((input) => input.id === AI_TEXT_RESULT_INPUT_ID)?.value
    ).toBe("edited generated text");
  });

  it("detects absence of AI history", () => {
    expect(hasAiTextGeneratedHistory(createTextNode().inputs)).toBe(false);
    expect(
      hasAiTextGeneratedHistory([
        {
          id: AI_TEXT_RESULT_HISTORY_INPUT_ID,
          name: AI_TEXT_RESULT_HISTORY_INPUT_ID,
          type: "json",
          value: { items: [], selectedId: null },
          hidden: true,
        },
      ])
    ).toBe(false);
  });
});
