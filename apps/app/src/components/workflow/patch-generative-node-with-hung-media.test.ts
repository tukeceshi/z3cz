import { describe, expect, it } from "vitest";

import {
  isGenerativeManualContent,
  shouldShowGenerativeBottomPanel,
} from "./generative-card-mode-utils";
import { patchGenerativeNodeWithHungMedia } from "./patch-generative-node-with-hung-media";
import type { WorkflowNodeType } from "./workflow-types";

const media = {
  resourceId: "res-1",
  mimeType: "image/png",
  kind: "ephemeral" as const,
};

function imageNode(prompt: string): WorkflowNodeType {
  return {
    name: "图片",
    nodeType: "ai-image",
    inputs: [{ id: "prompt", name: "prompt", type: "string", value: prompt }],
    outputs: [{ id: "images", name: "images", type: "image" }],
    executionState: "idle",
  };
}

describe("patchGenerativeNodeWithHungMedia", () => {
  it("keeps a prompted node generative instead of manual resource mode", () => {
    const patch = patchGenerativeNodeWithHungMedia({
      current: imageNode("模特穿橙色衬衫"),
      media,
      nodeType: "ai-image",
    });

    expect(isGenerativeManualContent(patch.metadata)).toBe(false);
    expect(shouldShowGenerativeBottomPanel(patch.metadata)).toBe(true);
    expect(
      patch.inputs?.find((input) => input.id === "images_result")?.value
    ).toEqual([media]);
    expect(
      patch.inputs?.find((input) => input.id === "manual_images")?.value
    ).toEqual([]);
  });

  it("uses manual resource mode when the node has no prompt", () => {
    const patch = patchGenerativeNodeWithHungMedia({
      current: imageNode(""),
      media,
      nodeType: "ai-image",
    });

    expect(isGenerativeManualContent(patch.metadata)).toBe(true);
    expect(shouldShowGenerativeBottomPanel(patch.metadata)).toBe(false);
    expect(
      patch.inputs?.find((input) => input.id === "manual_images")?.value
    ).toEqual([media]);
  });
});
