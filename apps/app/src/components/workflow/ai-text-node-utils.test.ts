import { describe, expect, it } from "vitest";

import type { WorkflowNodeType } from "./workflow-types";
import {
  AI_TEXT_OUTPUT_ID,
  AI_TEXT_RESULT_HISTORY_INPUT_ID,
  AI_TEXT_RESULT_INPUT_ID,
  hasAiTextGeneratedHistory,
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
