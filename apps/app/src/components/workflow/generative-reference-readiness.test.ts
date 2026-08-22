import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import { AI_IMAGE_PROMPT_HANDLE_ID } from "./ai-image-node-utils";
import { AI_TEXT_KEYWORDS_HANDLE_ID } from "./ai-text-node-utils";
import {
  evaluateGenerativeReferenceReadiness,
  isGenerativeReferenceInputTarget,
} from "./generative-reference-readiness";
import type { WorkflowNodeType } from "./workflow-types";

function textNode(params: {
  readonly metadata?: Record<string, string>;
  readonly result?: unknown;
}): WorkflowNodeType {
  return {
    nodeType: AI_TEXT_NODE_TYPE,
    name: "text",
    inputs: params.result
      ? [{ id: "result", name: "result", type: "string", value: params.result }]
      : [],
    outputs: [{ id: "text", name: "text", type: "string", value: "excerpt" }],
    metadata: params.metadata,
  } as WorkflowNodeType;
}

describe("evaluateGenerativeReferenceReadiness", () => {
  it("rejects generating text sources", () => {
    const verdict = evaluateGenerativeReferenceReadiness({
      sourceData: textNode({ metadata: { aiTextGenerating: "1" } }),
      targetNodeType: AI_TEXT_NODE_TYPE,
      targetHandleId: AI_TEXT_KEYWORDS_HANDLE_ID,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("generating");
  });

  it("rejects empty text for keyword references", () => {
    const verdict = evaluateGenerativeReferenceReadiness({
      sourceData: textNode({}),
      targetNodeType: AI_TEXT_NODE_TYPE,
      targetHandleId: AI_TEXT_KEYWORDS_HANDLE_ID,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("empty");
  });

  it("allows empty text for prompt references", () => {
    const verdict = evaluateGenerativeReferenceReadiness({
      sourceData: textNode({}),
      targetNodeType: AI_IMAGE_NODE_TYPE,
      targetHandleId: AI_IMAGE_PROMPT_HANDLE_ID,
    });
    expect(verdict.ok).toBe(true);
  });

  it("rejects pending resourceId text bodies", () => {
    const verdict = evaluateGenerativeReferenceReadiness({
      sourceData: textNode({
        result: { resourceId: "text-res-1", mimeType: "text/plain" },
      }),
      targetNodeType: AI_TEXT_NODE_TYPE,
      targetHandleId: AI_TEXT_KEYWORDS_HANDLE_ID,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("not_ready");
  });
});

describe("isGenerativeReferenceInputTarget", () => {
  it("matches keyword handle on text nodes", () => {
    expect(
      isGenerativeReferenceInputTarget(
        AI_TEXT_NODE_TYPE,
        AI_TEXT_KEYWORDS_HANDLE_ID
      )
    ).toBe(true);
  });
});
