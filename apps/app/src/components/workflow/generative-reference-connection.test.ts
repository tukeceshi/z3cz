import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import { AI_IMAGE_PROMPT_HANDLE_ID, AI_IMAGE_REFERENCE_HANDLE_ID } from "./ai-image-node-utils";
import { AI_TEXT_OUTPUT_ID } from "./ai-text-node-utils";
import {
  appendGenerativeReferenceConnection,
  buildPanelReferenceConnection,
  canConnectGenerativeReferenceConnection,
} from "./generative-reference-connection";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

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

describe("buildPanelReferenceConnection", () => {
  it("routes text output to image prompt handle", () => {
    const connection = buildPanelReferenceConnection({
      sourceNodeId: "text-1",
      sourceHandle: AI_TEXT_OUTPUT_ID,
      targetNodeId: "image-1",
      nodes: [node("text-1", AI_TEXT_NODE_TYPE), node("image-1", AI_IMAGE_NODE_TYPE)],
    });

    expect(connection).toEqual({
      source: "text-1",
      sourceHandle: AI_TEXT_OUTPUT_ID,
      target: "image-1",
      targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
    });
  });
});

describe("canConnectGenerativeReferenceConnection", () => {
  it("accepts text to image via reference handle after normalization", () => {
    const nodes = [node("text-1", AI_TEXT_NODE_TYPE), node("image-1", AI_IMAGE_NODE_TYPE)];

    expect(
      canConnectGenerativeReferenceConnection({
        sourceNodeId: "text-1",
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetNodeId: "image-1",
        nodes,
        edges: [],
      })
    ).toBe(true);
  });

  it("rejects duplicate prompt references", () => {
    const nodes = [node("text-1", AI_TEXT_NODE_TYPE), node("image-1", AI_IMAGE_NODE_TYPE)];
    const edges = [
      {
        id: "existing",
        source: "text-0",
        target: "image-1",
        targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
        type: "workflowEdge",
      },
    ] as WorkflowEdgeType[];

    expect(
      canConnectGenerativeReferenceConnection({
        sourceNodeId: "text-1",
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetNodeId: "image-1",
        nodes,
        edges,
      })
    ).toBe(false);
  });
});

describe("appendGenerativeReferenceConnection", () => {
  it("normalizes text onto image reference handle when committing", () => {
    const nodes = [node("text-1", AI_TEXT_NODE_TYPE), node("image-1", AI_IMAGE_NODE_TYPE)];
    let nextEdges: WorkflowEdgeType[] = [];

    const ok = appendGenerativeReferenceConnection({
      connection: {
        source: "text-1",
        sourceHandle: AI_TEXT_OUTPUT_ID,
        target: "image-1",
        targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
      },
      nodes,
      edges: [],
      setEdges: (updater) => {
        nextEdges = updater([]);
      },
      createObjectUrl: () => "blob:test",
    });

    expect(ok).toBe(true);
    expect(nextEdges).toHaveLength(1);
    expect(nextEdges[0]?.targetHandle).toBe(AI_IMAGE_PROMPT_HANDLE_ID);
  });
});
