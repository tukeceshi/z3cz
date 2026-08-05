import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { AI_IMAGE_OUTPUT_ID, AI_IMAGE_PROMPT_HANDLE_ID } from "./ai-image-node-utils";
import { AI_TEXT_CARD_HEIGHT_PX, AI_TEXT_OUTPUT_ID, AI_TEXT_KEYWORDS_HANDLE_ID } from "./ai-text-node-utils";
import { WORKFLOW_NODE_GAP_PX } from "./workflow-node-placement";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";
import {
  applyWorkflowLayoutPostprocess,
  enforceGenerativeColumnGapPushUp,
  snapGenerativeFlowEdgeCenterY,
} from "./workflow-layout-postprocess";

function node(id: string, nodeType: string): ReactFlowNode<WorkflowNodeType> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { nodeType } as WorkflowNodeType,
  } as ReactFlowNode<WorkflowNodeType>;
}

describe("snapGenerativeFlowEdgeCenterY", () => {
  it("aligns text 6 to left image on keywords edge then right image on prompt", () => {
    const leftImage = "ai-image-left";
    const text6 = "ai-text-6";
    const rightImage = "ai-image-right";

    const positions = new Map([
      [leftImage, { x: 1111.5, y: 10 }],
      [text6, { x: 1624, y: 40.5 }],
      [rightImage, { x: 2084, y: 0 }],
    ]);
    const dimensions = new Map([
      [leftImage, { width: 343, height: 272 }],
      [text6, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
      [rightImage, { width: 272, height: 272 }],
    ]);
    const nodesById = new Map([
      [leftImage, node(leftImage, AI_IMAGE_NODE_TYPE)],
      [text6, node(text6, AI_TEXT_NODE_TYPE)],
      [rightImage, node(rightImage, AI_IMAGE_NODE_TYPE)],
    ]);
    const edges = [
      {
        id: "kw",
        source: leftImage,
        target: text6,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      },
      {
        id: "pr",
        source: text6,
        target: rightImage,
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);

    const leftCenter = 10 + 272 / 2;
    const textY = positions.get(text6)?.y ?? 0;
    const rightY = positions.get(rightImage)?.y ?? 0;

    expect(textY + AI_TEXT_CARD_HEIGHT_PX / 2).toBeCloseTo(leftCenter, 5);
    expect(rightY + 272 / 2).toBeCloseTo(textY + AI_TEXT_CARD_HEIGHT_PX / 2, 5);
  });

  it("skips prompt snap when one text fans out to multiple images", () => {
    const text1 = "ai-text-1";
    const image1 = "ai-image-1";
    const image3 = "ai-image-3";

    const positions = new Map([
      [text1, { x: 61, y: 229 }],
      [image1, { x: 582, y: 50 }],
      [image3, { x: 687, y: 300 }],
    ]);
    const dimensions = new Map([
      [text1, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
      [image1, { width: 272, height: 272 }],
      [image3, { width: 272, height: 272 }],
    ]);
    const nodesById = new Map([
      [text1, node(text1, AI_TEXT_NODE_TYPE)],
      [image1, node(image1, AI_IMAGE_NODE_TYPE)],
      [image3, node(image3, AI_IMAGE_NODE_TYPE)],
    ]);
    const edges = [
      {
        id: "pr1",
        source: text1,
        target: image1,
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
      },
      {
        id: "pr3",
        source: text1,
        target: image3,
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);

    expect(positions.get(image1)?.y).toBe(50);
    expect(positions.get(image3)?.y).toBe(300);
  });

  it("skips keywords snap when one source fans out to multiple texts", () => {
    const text1 = "ai-text-1";
    const text2 = "ai-text-2";
    const text5 = "ai-text-5";

    const positions = new Map([
      [text1, { x: 0, y: 871.5 }],
      [text2, { x: 521, y: 50 }],
      [text5, { x: 521, y: 300 }],
    ]);
    const dimensions = new Map([
      [text1, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
      [text2, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
      [text5, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
    ]);
    const nodesById = new Map([
      [text1, node(text1, AI_TEXT_NODE_TYPE)],
      [text2, node(text2, AI_TEXT_NODE_TYPE)],
      [text5, node(text5, AI_TEXT_NODE_TYPE)],
    ]);
    const edges = [
      {
        id: "kw2",
        source: text1,
        target: text2,
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      },
      {
        id: "kw5",
        source: text1,
        target: text5,
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);

    expect(positions.get(text2)?.y).toBe(50);
    expect(positions.get(text5)?.y).toBe(300);
  });

  it("skips keywords snap when multiple sources feed one text", () => {
    const image2 = "ai-image-2";
    const image4 = "ai-image-4";
    const text2 = "ai-text-2";

    const positions = new Map([
      [image2, { x: 1164, y: 0 }],
      [image4, { x: 1164, y: 377 }],
      [text2, { x: 1536, y: 40.5 }],
    ]);
    const dimensions = new Map([
      [image2, { width: 272, height: 272 }],
      [image4, { width: 272, height: 272 }],
      [text2, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
    ]);
    const nodesById = new Map([
      [image2, node(image2, AI_IMAGE_NODE_TYPE)],
      [image4, node(image4, AI_IMAGE_NODE_TYPE)],
      [text2, node(text2, AI_TEXT_NODE_TYPE)],
    ]);
    const edges = [
      {
        id: "kw2",
        source: image2,
        target: text2,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      },
      {
        id: "kw4",
        source: image4,
        target: text2,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);

    expect(positions.get(text2)?.y).toBe(40.5);
  });

  it("ignores reference_images edges", () => {
    const a = "ai-image-a";
    const b = "ai-image-b";
    const positions = new Map([
      [a, { x: 0, y: 100 }],
      [b, { x: 500, y: 200 }],
    ]);
    const dimensions = new Map([
      [a, { width: 270, height: 270 }],
      [b, { width: 270, height: 270 }],
    ]);
    const nodesById = new Map([
      [a, node(a, AI_IMAGE_NODE_TYPE)],
      [b, node(b, AI_IMAGE_NODE_TYPE)],
    ]);
    const edges = [
      {
        id: "ref",
        source: a,
        target: b,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: "reference_images",
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);

    expect(positions.get(b)?.y).toBe(200);
  });
});

describe("enforceGenerativeColumnGapPushUp", () => {
  it("anchors the bottom node and moves upper nodes up", () => {
    const topImage = "ai-image-top";
    const bottomImage = "ai-image-bottom";

    const positions = new Map([
      [topImage, { x: 1042, y: 642.5 }],
      [bottomImage, { x: 1042.5, y: 923.5 }],
    ]);
    const dimensions = new Map([
      [topImage, { width: 272, height: 272 }],
      [bottomImage, { width: 272, height: 272 }],
    ]);
    const nodesById = new Map([
      [topImage, node(topImage, AI_IMAGE_NODE_TYPE)],
      [bottomImage, node(bottomImage, AI_IMAGE_NODE_TYPE)],
    ]);

    enforceGenerativeColumnGapPushUp(positions, dimensions, nodesById);

    expect(positions.get(bottomImage)?.y).toBe(923.5);
    expect(positions.get(topImage)?.y).toBe(923.5 - WORKFLOW_NODE_GAP_PX - 272);
  });
});

describe("applyWorkflowLayoutPostprocess", () => {
  it("runs snap then column gap push-up", () => {
    const topImage = "ai-image-top";
    const bottomImage = "ai-image-bottom";

    const positions = new Map([
      [topImage, { x: 1042, y: 642.5 }],
      [bottomImage, { x: 1042.5, y: 923.5 }],
    ]);
    const dimensions = new Map([
      [topImage, { width: 272, height: 272 }],
      [bottomImage, { width: 272, height: 272 }],
    ]);
    const nodesById = new Map([
      [topImage, node(topImage, AI_IMAGE_NODE_TYPE)],
      [bottomImage, node(bottomImage, AI_IMAGE_NODE_TYPE)],
    ]);

    applyWorkflowLayoutPostprocess(positions, dimensions, [], nodesById);

    expect(positions.get(bottomImage)?.y).toBe(923.5);
    expect(positions.get(topImage)?.y).toBe(923.5 - WORKFLOW_NODE_GAP_PX - 272);
  });
});
