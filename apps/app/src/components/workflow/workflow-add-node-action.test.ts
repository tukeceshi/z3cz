import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import { AI_IMAGE_PROMPT_HANDLE_ID } from "./ai-image-node-utils";
import { AI_TEXT_OUTPUT_ID } from "./ai-text-node-utils";
import { AI_VIDEO_REFERENCE_HANDLE_ID } from "./ai-video-node-utils";
import { buildReferenceConnectionToNewNode } from "./workflow-add-node-connection";
import {
  findOpenNodePositionFromSource,
  findOpenNodePositionNearPoint,
} from "./workflow-node-placement";
import type { WorkflowNodeType } from "./workflow-types";

function node(
  id: string,
  nodeType: string,
  data?: Partial<WorkflowNodeType>
) {
  return {
    id,
    data: {
      nodeType,
      name: id,
      inputs: [],
      outputs: [],
      ...data,
    } as WorkflowNodeType,
  };
}

describe("buildReferenceConnectionToNewNode", () => {
  it("connects text output to new image prompt handle", () => {
    const targetId = "image-new";
    const connection = buildReferenceConnectionToNewNode({
      dragFromNodeId: "text-1",
      dragFromHandle: { type: "source", id: AI_TEXT_OUTPUT_ID },
      targetNodeId: targetId,
      nodes: [
        node("text-1", AI_TEXT_NODE_TYPE),
        node(targetId, AI_IMAGE_NODE_TYPE),
      ],
    });

    expect(connection).toEqual({
      source: "text-1",
      sourceHandle: AI_TEXT_OUTPUT_ID,
      target: targetId,
      targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
    });
  });

  it("connects image output to new video reference handle", () => {
    const targetId = "video-new";
    const connection = buildReferenceConnectionToNewNode({
      dragFromNodeId: "image-1",
      dragFromHandle: { type: "source", id: "images" },
      targetNodeId: targetId,
      nodes: [
        node("image-1", AI_IMAGE_NODE_TYPE),
        node(targetId, AI_VIDEO_NODE_TYPE),
      ],
    });

    expect(connection).toEqual({
      source: "image-1",
      sourceHandle: "images",
      target: targetId,
      targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
    });
  });

  it("returns null for target handle drag", () => {
    const connection = buildReferenceConnectionToNewNode({
      dragFromNodeId: "text-1",
      dragFromHandle: { type: "target", id: "keywords" },
      targetNodeId: "text-2",
      nodes: [node("text-1", AI_TEXT_NODE_TYPE), node("text-2", AI_TEXT_NODE_TYPE)],
    });

    expect(connection).toBeNull();
  });
});

describe("findOpenNodePositionFromSource", () => {
  it("places the new node to the right of the source", () => {
    const position = findOpenNodePositionFromSource({
      sourceNode: {
        id: "source",
        position: { x: 100, y: 200 },
        data: { nodeType: AI_TEXT_NODE_TYPE },
      },
      targetNodeType: AI_IMAGE_NODE_TYPE,
      existingNodes: [
        {
          id: "source",
          position: { x: 100, y: 200 },
          data: { nodeType: AI_TEXT_NODE_TYPE },
        },
      ],
    });

    expect(position.x).toBeGreaterThan(100);
    expect(position.y).toBeTypeOf("number");
  });
});

describe("findOpenNodePositionNearPoint", () => {
  it("centers placement around the clicked flow point", () => {
    const position = findOpenNodePositionNearPoint({
      flowPoint: { x: 500, y: 400 },
      nodeType: AI_TEXT_NODE_TYPE,
      existingNodes: [],
    });

    expect(position.x).toBeLessThan(500);
    expect(position.y).toBeLessThan(400);
  });
});
