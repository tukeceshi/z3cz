import { describe, expect, it, vi } from "vitest";

import {
  AI_TEXT_BODY_OUTPUT_ID,
  AI_TEXT_OUTPUT_ID,
  AI_TEXT_RESULT_INPUT_ID,
  readAiTextResultTextSync,
} from "./ai-text-node-utils";
import {
  isUpstreamAiTextPendingLoad,
  readAiTextGeneratingStreamSync,
  readAiTextResultExcerptSync,
  resolveAiTextReferenceInputsFromChips,
  resolveReferencedAiTextFromEdges,
} from "./resolve-ai-text-result";
import type { WorkflowNodeType } from "./workflow-types";

vi.mock("@/services/ai-text-cache-layer", () => ({
  readAiTextFullBodyFromStaging: vi.fn(async () => "staged body"),
}));

function createTextNode(
  overrides?: Partial<
    Pick<WorkflowNodeType, "id" | "inputs" | "outputs" | "metadata">
  >
): WorkflowNodeType {
  return {
    id: "node-1",
    type: "workflowNode",
    name: "AI Text",
    nodeType: "ai-text",
    position: { x: 0, y: 0 },
    inputs: [],
    outputs: [
      { id: AI_TEXT_OUTPUT_ID, name: "text", type: "string", value: "" },
      { id: AI_TEXT_BODY_OUTPUT_ID, name: "textBody", type: "string", value: "" },
    ],
    metadata: undefined,
    ...overrides,
  };
}

describe("resolve-ai-text-result", () => {
  it("reads full body from textBody and ignores the generation prompt input", () => {
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
          value: "short preview",
        },
        {
          id: AI_TEXT_BODY_OUTPUT_ID,
          name: "textBody",
          type: "string",
          value: "  final poem  ",
        },
      ],
    });

    expect(readAiTextResultTextSync(node)).toBe("final poem");
    expect(readAiTextResultExcerptSync(node)).toBe("short preview");
  });

  it("marks stored bodies without staging state as pending", () => {
    const node = createTextNode({
      inputs: [
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

    expect(isUpstreamAiTextPendingLoad(node)).toBe(true);
    expect(readAiTextGeneratingStreamSync(node)).toBe("");
  });

  it("is not pending once staging marks ready", () => {
    const node = createTextNode({
      inputs: [
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
      metadata: { aiTextStagingState: "ready" },
    });

    expect(isUpstreamAiTextPendingLoad(node)).toBe(false);
  });

  it("reads generating stream from session body only", () => {
    const node = createTextNode({
      metadata: { aiTextGenerating: "1" },
      outputs: [
        { id: AI_TEXT_OUTPUT_ID, name: "text", type: "string", value: "preview" },
        {
          id: AI_TEXT_BODY_OUTPUT_ID,
          name: "textBody",
          type: "string",
          value: "live stream",
        },
      ],
    });

    expect(readAiTextGeneratingStreamSync(node)).toBe("live stream");
  });

  it("resolves referenced prompt from staging, not session preview", async () => {
    const source = createTextNode({
      id: "text-source",
      inputs: [
        {
          id: AI_TEXT_RESULT_INPUT_ID,
          name: AI_TEXT_RESULT_INPUT_ID,
          type: "json",
          value: {
            resourceId: "res-1",
            mimeType: "text/plain; charset=utf-8",
          },
        },
      ],
      outputs: [
        { id: AI_TEXT_OUTPUT_ID, name: "text", type: "string", value: "preview" },
        {
          id: AI_TEXT_BODY_OUTPUT_ID,
          name: "textBody",
          type: "string",
          value: "mirrored body",
        },
      ],
    });

    const text = await resolveReferencedAiTextFromEdges({
      nodeId: "image-1",
      targetHandle: "prompt_reference",
      edges: [
        {
          source: "text-source",
          target: "image-1",
          targetHandle: "prompt_reference",
        },
      ],
      nodes: [{ id: "text-source", data: source }],
      organizationId: "org",
      workflowId: "wf",
    });

    expect(text).toBe("staged body");
  });

  it("builds keyword references from staging", async () => {
    const source = createTextNode({
      id: "text-source",
      inputs: [
        {
          id: AI_TEXT_RESULT_INPUT_ID,
          name: AI_TEXT_RESULT_INPUT_ID,
          type: "json",
          value: {
            resourceId: "res-1",
            mimeType: "text/plain; charset=utf-8",
          },
        },
      ],
      outputs: [
        { id: AI_TEXT_OUTPUT_ID, name: "text", type: "string", value: "preview" },
        {
          id: AI_TEXT_BODY_OUTPUT_ID,
          name: "textBody",
          type: "string",
          value: "keyword body",
        },
      ],
    });

    const refs = await resolveAiTextReferenceInputsFromChips({
      chips: [
        {
          edgeId: "e1",
          sourceNodeId: "text-source",
          kind: "text",
          label: "Text 1",
        },
      ],
      nodes: [{ id: "text-source", data: source }],
      organizationId: "org",
      workflowId: "wf",
    });

    expect(refs).toEqual([{ name: "Text 1", content: "staged body" }]);
  });
});
