import { AI_IMAGE_NODE_TYPE } from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { applyGenerativeNodeStudioReference } from "./create-generative-node-from-studio-reference";
import type { WorkflowNodeType } from "./workflow-types";

function createNode(): ReactFlowNode<WorkflowNodeType> {
  return {
    id: "ai-image-test",
    type: "workflowNode",
    position: { x: 0, y: 0 },
    data: {
      name: "图片 1",
      nodeType: AI_IMAGE_NODE_TYPE,
      inputs: [],
      outputs: [],
      executionState: "idle",
    },
  };
}

describe("applyGenerativeNodeStudioReference", () => {
  const existingNodes = [{ data: { nodeType: AI_IMAGE_NODE_TYPE } }];

  it("uses the heading title without a sequence suffix", () => {
    const result = applyGenerativeNodeStudioReference({
      node: createNode(),
      nodeType: AI_IMAGE_NODE_TYPE,
      existingNodes,
      defaultBaseName: "图片",
      prompt: "| A | B |\n|---|---|",
      precedingText: "Notes\n\n## 场景列表\n",
    });

    expect(result.data.name).toBe("场景列表");
  });

  it("keeps the default sequenced name when no heading exists", () => {
    const result = applyGenerativeNodeStudioReference({
      node: createNode(),
      nodeType: AI_IMAGE_NODE_TYPE,
      existingNodes,
      defaultBaseName: "图片",
      prompt: "| A | B |\n|---|---|",
      precedingText: "Plain text only\n",
    });

    expect(result.data.name).toBe("图片 2");
  });

  it("writes the table markdown into prompt", () => {
    const prompt = "| Name | Value |\n|---|---|";
    const result = applyGenerativeNodeStudioReference({
      node: createNode(),
      nodeType: AI_IMAGE_NODE_TYPE,
      existingNodes,
      defaultBaseName: "图片",
      prompt,
      precedingText: "## Sheet\n",
    });

    expect(result.data.inputs.find((input) => input.id === "prompt")?.value).toBe(
      prompt
    );
  });
});
