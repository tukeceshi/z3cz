import { describe, expect, it } from "vitest";

import type { WorkflowNodeType } from "./workflow-types";
import type { NodeType } from "./workflow-types";
import {
  AI_TEXT_BODY_OUTPUT_ID,
  AI_TEXT_KEYWORDS_HANDLE_ID,
  AI_TEXT_OUTPUT_ID,
  AI_TEXT_RESULT_HISTORY_INPUT_ID,
  AI_TEXT_RESULT_INPUT_ID,
  hasAiTextGeneratedHistory,
  mergeAiTextNodeCatalogInputs,
  readAiTextResult,
  readAiTextResultHistory,
  readAiTextSessionBodySync,
  withAiTextEditedResult,
  withAiTextGeneratedResult,
  withAiTextManualResult,
  withAiTextStreamingPreview,
  isAiTextAwaitingStream,
  withAiTextGeneratingFlag,
} from "./ai-text-node-utils";
import { isGenerativeManualContent } from "./generative-card-mode-utils";

function createTextNode(
  overrides?: Partial<Pick<WorkflowNodeType, "inputs" | "outputs">>
): WorkflowNodeType {
  return {
    id: "node-1",
    type: "workflowNode",
    name: "AI Text",
    nodeType: "ai-text",
    position: { x: 0, y: 0 },
    inputs: overrides?.inputs ?? [],
    outputs:
      overrides?.outputs ??
      [{ id: AI_TEXT_OUTPUT_ID, name: "text", type: "string", value: "" }],
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

  it("reads session body when result is an external reference", () => {
    const node = createTextNode();
    const text = readAiTextResult(
      [
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
      [
        { id: AI_TEXT_OUTPUT_ID, name: "text", type: "string", value: "excerpt" },
        { id: AI_TEXT_BODY_OUTPUT_ID, name: "textBody", type: "string", value: "full body" },
      ]
    );

    expect(text).toBe("full body");
  });

  it("streaming preview writes session outputs only", () => {
    const node = createTextNode({
      inputs: [
        {
          id: AI_TEXT_RESULT_INPUT_ID,
          name: AI_TEXT_RESULT_INPUT_ID,
          type: "json",
          value: {
            resourceId: "media-1",
            mimeType: "text/plain; charset=utf-8",
          },
        },
      ],
    });

    const patch = withAiTextStreamingPreview(node, "一位成年动漫美少女");
    expect(patch.inputs).toBeUndefined();
    expect(
      patch.outputs?.find((output) => output.id === AI_TEXT_BODY_OUTPUT_ID)?.value
    ).toBe("一位成年动漫美少女");
    expect(
      patch.outputs?.find((output) => output.id === AI_TEXT_OUTPUT_ID)?.value
    ).toBe("一位成年动漫美少女");
  });

  it("keeps awaiting-stream until the first preview token", () => {
    const node = createTextNode({
      outputs: [
        { id: AI_TEXT_OUTPUT_ID, name: "text", type: "string", value: "old excerpt" },
        { id: AI_TEXT_BODY_OUTPUT_ID, name: "textBody", type: "string", value: "old body" },
      ],
    });
    const started = withAiTextStreamingPreview(node, "");
    const generating = withAiTextGeneratingFlag(started.metadata, true);
    expect(isAiTextAwaitingStream(generating)).toBe(true);

    const firstToken = withAiTextStreamingPreview(
      { ...node, metadata: generating, outputs: started.outputs ?? node.outputs },
      "一"
    );
    expect(isAiTextAwaitingStream(firstToken.metadata)).toBe(false);
  });

  it("reads session body without distinguishing fullwidth table pipes", () => {
    const node = createTextNode({
      outputs: [
        {
          id: AI_TEXT_BODY_OUTPUT_ID,
          name: "textBody",
          type: "string",
          value: "| 镜头｜时间线 |\n| --- | --- |",
        },
      ],
    });

    expect(readAiTextSessionBodySync(node)).toBe("| 镜头|时间线 |\n| --- | --- |");
  });
});
