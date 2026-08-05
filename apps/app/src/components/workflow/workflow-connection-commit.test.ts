import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import { AI_IMAGE_PROMPT_HANDLE_ID } from "./ai-image-node-utils";
import { AI_TEXT_OUTPUT_ID } from "./ai-text-node-utils";
import {
  mergePreparedWorkflowEdge,
  prepareWorkflowConnectionAppend,
} from "./workflow-connection-commit";
import type { WorkflowNodeType } from "./workflow-types";

function node(id: string, nodeType: string): {
  id: string;
  data: WorkflowNodeType;
} {
  return {
    id,
    data: {
      nodeType,
      name: id,
      inputs: [],
      outputs: [{ id: AI_TEXT_OUTPUT_ID, name: AI_TEXT_OUTPUT_ID, type: "string" }],
    } as WorkflowNodeType,
  };
}

describe("prepareWorkflowConnectionAppend", () => {
  it("builds an edge when the target node exists in the snapshot", () => {
    const textNode = node("text-1", AI_TEXT_NODE_TYPE);
    const imageNode = node("image-1", AI_IMAGE_NODE_TYPE);
    const connection = {
      source: "text-1",
      target: "image-1",
      sourceHandle: AI_TEXT_OUTPUT_ID,
      targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
    };

    const prepared = prepareWorkflowConnectionAppend({
      connection,
      nodes: [textNode, imageNode],
      edges: [],
      createObjectUrl: () => "blob:test",
    });

    expect(prepared?.edge.target).toBe("image-1");
    expect(prepared?.edge.source).toBe("text-1");
  });

  it("returns null when the target node is missing from the snapshot", () => {
    const prepared = prepareWorkflowConnectionAppend({
      connection: {
        source: "text-1",
        target: "missing",
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
      },
      nodes: [node("text-1", AI_TEXT_NODE_TYPE)],
      edges: [],
      createObjectUrl: () => "blob:test",
    });

    expect(prepared).toBeNull();
  });
});

describe("mergePreparedWorkflowEdge", () => {
  it("replaces a non-repeated prompt edge", () => {
    const prepared = prepareWorkflowConnectionAppend({
      connection: {
        source: "text-1",
        target: "image-1",
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
      },
      nodes: [node("text-1", AI_TEXT_NODE_TYPE), node("image-1", AI_IMAGE_NODE_TYPE)],
      edges: [],
      createObjectUrl: () => "blob:test",
    });
    expect(prepared).not.toBeNull();
    if (!prepared) {
      return;
    }

    const merged = mergePreparedWorkflowEdge(
      [
        {
          id: "old-edge",
          source: "text-0",
          target: "image-1",
          targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
          type: "workflowEdge",
        },
      ],
      prepared
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe(prepared.edge.id);
  });
});
