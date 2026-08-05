import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
  AI_IMAGE_OUTPUT_ID,
  AI_IMAGE_PROMPT_HANDLE_ID,
  AI_IMAGE_REFERENCE_HANDLE_ID,
} from "./ai-image-node-utils";
import {
  AI_TEXT_CARD_HEIGHT_PX,
  AI_TEXT_OUTPUT_ID,
  AI_TEXT_KEYWORDS_HANDLE_ID,
} from "./ai-text-node-utils";
import { AI_VIDEO_REFERENCE_HANDLE_ID } from "./ai-video-node-utils";
import { WORKFLOW_NODE_GAP_PX } from "./workflow-node-placement";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";
import {
  applyWorkflowLayoutPostprocess,
  enforceGenerativeColumnGapPushDown,
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

  it("aligns single reference_images edge centerY", () => {
    const leftImage = "ai-image-left";
    const rightImage = "ai-image-right";
    const positions = new Map([
      [leftImage, { x: 582, y: 516.75 }],
      [rightImage, { x: 1233.5, y: 506.75 }],
    ]);
    const dimensions = new Map([
      [leftImage, { width: 272, height: 272 }],
      [rightImage, { width: 272, height: 272 }],
    ]);
    const nodesById = new Map([
      [leftImage, node(leftImage, AI_IMAGE_NODE_TYPE)],
      [rightImage, node(rightImage, AI_IMAGE_NODE_TYPE)],
    ]);
    const edges = [
      {
        id: "ref",
        source: leftImage,
        target: rightImage,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);

    const leftCenter = 516.75 + 272 / 2;
    const rightCenter = (positions.get(rightImage)?.y ?? 0) + 272 / 2;
    expect(rightCenter).toBeCloseTo(leftCenter, 5);
  });

  it("snaps near-aligned reference fan-out while skipping far targets", () => {
    const leftAdult = "ai-image-left-adult";
    const rightAdult = "ai-image-right-adult";
    const bottomStudent = "ai-image-bottom-student";

    const positions = new Map([
      [leftAdult, { x: 582, y: 516.75 }],
      [rightAdult, { x: 1233.5, y: 506.75 }],
      [bottomStudent, { x: 1164, y: 1327.75 }],
    ]);
    const dimensions = new Map([
      [leftAdult, { width: 482, height: 272 }],
      [rightAdult, { width: 343, height: 272 }],
      [bottomStudent, { width: 481, height: 272 }],
    ]);
    const nodesById = new Map([
      [leftAdult, node(leftAdult, AI_IMAGE_NODE_TYPE)],
      [rightAdult, node(rightAdult, AI_IMAGE_NODE_TYPE)],
      [bottomStudent, node(bottomStudent, AI_IMAGE_NODE_TYPE)],
    ]);
    const edges = [
      {
        id: "ref-adult-chain",
        source: leftAdult,
        target: rightAdult,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
      },
      {
        id: "ref-far-branch",
        source: leftAdult,
        target: bottomStudent,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);

    const leftCenter = 516.75 + 272 / 2;
    const rightCenter = (positions.get(rightAdult)?.y ?? 0) + 272 / 2;
    expect(rightCenter).toBeCloseTo(leftCenter, 5);
    expect(positions.get(bottomStudent)?.y).toBe(1327.75);
  });

  it("aligns keywords target after reference moves source", () => {
    const leftAdult = "ai-image-left-adult";
    const rightAdult = "ai-image-right-adult";
    const text6 = "ai-text-6";

    const positions = new Map([
      [leftAdult, { x: 582, y: 516.75 }],
      [rightAdult, { x: 1233.5, y: 506.75 }],
      [text6, { x: 1807, y: 547.25 }],
    ]);
    const dimensions = new Map([
      [leftAdult, { width: 482, height: 272 }],
      [rightAdult, { width: 343, height: 272 }],
      [text6, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
    ]);
    const nodesById = new Map([
      [leftAdult, node(leftAdult, AI_IMAGE_NODE_TYPE)],
      [rightAdult, node(rightAdult, AI_IMAGE_NODE_TYPE)],
      [text6, node(text6, AI_TEXT_NODE_TYPE)],
    ]);
    const edges = [
      {
        id: "ref-adult-chain",
        source: leftAdult,
        target: rightAdult,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
      },
      {
        id: "kw-text6",
        source: rightAdult,
        target: text6,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);

    const rightCenter = (positions.get(rightAdult)?.y ?? 0) + 272 / 2;
    const textCenter = (positions.get(text6)?.y ?? 0) + AI_TEXT_CARD_HEIGHT_PX / 2;
    expect(rightCenter).toBeCloseTo(516.75 + 272 / 2, 5);
    expect(textCenter).toBeCloseTo(rightCenter, 5);
  });

  it("snaps reference fan-in to the leftmost source", () => {
    const leftImage = "ai-image-left";
    const rightImage = "ai-image-right";
    const video = "ai-video-1";

    const positions = new Map([
      [leftImage, { x: 1164, y: 90 }],
      [rightImage, { x: 1233, y: 500 }],
      [video, { x: 1851, y: 10 }],
    ]);
    const dimensions = new Map([
      [leftImage, { width: 272, height: 272 }],
      [rightImage, { width: 272, height: 272 }],
      [video, { width: 480, height: 270 }],
    ]);
    const nodesById = new Map([
      [leftImage, node(leftImage, AI_IMAGE_NODE_TYPE)],
      [rightImage, node(rightImage, AI_IMAGE_NODE_TYPE)],
      [video, node(video, AI_VIDEO_NODE_TYPE)],
    ]);
    const edges = [
      {
        id: "ref-left",
        source: leftImage,
        target: video,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
      },
      {
        id: "ref-right",
        source: rightImage,
        target: video,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);

    const leftCenter = 90 + 272 / 2;
    const videoCenter = (positions.get(video)?.y ?? 0) + 270 / 2;
    expect(videoCenter).toBeCloseTo(leftCenter, 5);
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

  it("skips keywords snap when cross-type snap targets would overlap", () => {
    const image1 = "ai-image-1";
    const image2 = "ai-image-2";
    const text6 = "ai-text-6";

    const positions = new Map([
      [image1, { x: 582, y: 168.25 }],
      [image2, { x: 1208, y: 168.25 }],
      [text6, { x: 1164, y: 208.75 }],
    ]);
    const dimensions = new Map([
      [image1, { width: 482, height: 277 }],
      [image2, { width: 272, height: 277 }],
      [text6, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
    ]);
    const nodesById = new Map([
      [image1, node(image1, AI_IMAGE_NODE_TYPE)],
      [image2, node(image2, AI_IMAGE_NODE_TYPE)],
      [text6, node(text6, AI_TEXT_NODE_TYPE)],
    ]);
    const edges = [
      {
        id: "ref",
        source: image1,
        target: image2,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_IMAGE_REFERENCE_HANDLE_ID,
      },
      {
        id: "kw",
        source: image1,
        target: text6,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);

    const image1Center = 168.25 + 277 / 2;
    const image2Center = (positions.get(image2)?.y ?? 0) + 277 / 2;
    expect(image2Center).toBeCloseTo(image1Center, 5);
    expect(positions.get(text6)?.y).toBe(208.75);
  });

  it("snaps keywords when cross-type snap targets would not overlap", () => {
    const rightAdult = "ai-image-right-adult";
    const student = "ai-image-student";
    const text6 = "ai-text-6";
    const video = "ai-video-1";

    const positions = new Map([
      [rightAdult, { x: 1233.5, y: 516.75 }],
      [student, { x: 1164.5, y: 90 }],
      [text6, { x: 1807, y: 577 }],
      [video, { x: 1851, y: -10 }],
    ]);
    const dimensions = new Map([
      [rightAdult, { width: 343, height: 277 }],
      [student, { width: 481, height: 277 }],
      [text6, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
      [video, { width: 272, height: 477 }],
    ]);
    const nodesById = new Map([
      [rightAdult, node(rightAdult, AI_IMAGE_NODE_TYPE)],
      [student, node(student, AI_IMAGE_NODE_TYPE)],
      [text6, node(text6, AI_TEXT_NODE_TYPE)],
      [video, node(video, AI_VIDEO_NODE_TYPE)],
    ]);
    const edges = [
      {
        id: "ref-student-video",
        source: student,
        target: video,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
      },
      {
        id: "ref-adult-video",
        source: rightAdult,
        target: video,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
      },
      {
        id: "kw-text6",
        source: rightAdult,
        target: text6,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    snapGenerativeFlowEdgeCenterY(positions, dimensions, edges, nodesById);

    const rightCenter = 516.75 + 277 / 2;
    const textCenter = (positions.get(text6)?.y ?? 0) + AI_TEXT_CARD_HEIGHT_PX / 2;
    expect(textCenter).toBeCloseTo(rightCenter, 5);
  });
});

describe("enforceGenerativeColumnGapPushDown", () => {
  it("pushes lower node down when centerX column nodes overlap after snap", () => {
    const image2 = "ai-image-2";
    const text6 = "ai-text-6";

    const positions = new Map([
      [image2, { x: 1208, y: 168.25 }],
      [text6, { x: 1164, y: 377 }],
    ]);
    const dimensions = new Map([
      [image2, { width: 272, height: 277 }],
      [text6, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
    ]);
    const nodesById = new Map([
      [image2, node(image2, AI_IMAGE_NODE_TYPE)],
      [text6, node(text6, AI_TEXT_NODE_TYPE)],
    ]);

    enforceGenerativeColumnGapPushDown(positions, dimensions, nodesById);

    expect(positions.get(text6)?.y).toBe(168.25 + 277 + WORKFLOW_NODE_GAP_PX);
  });

  it("does not push when centerX column nodes only have sub-minGap spacing", () => {
    const video = "ai-video-1";
    const text6 = "ai-text-6";

    const positions = new Map([
      [video, { x: 1851, y: -10 }],
      [text6, { x: 1807, y: 554.75 }],
    ]);
    const dimensions = new Map([
      [video, { width: 272, height: 477 }],
      [text6, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
    ]);
    const nodesById = new Map([
      [video, node(video, AI_VIDEO_NODE_TYPE)],
      [text6, node(text6, AI_TEXT_NODE_TYPE)],
    ]);

    enforceGenerativeColumnGapPushDown(positions, dimensions, nodesById);

    expect(positions.get(text6)?.y).toBe(554.75);
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

  it("does not treat adjacent ranks as the same column", () => {
    const textNode = "ai-text-6";
    const videoNode = "ai-video-1";

    const positions = new Map([
      [textNode, { x: 1807, y: 400 }],
      [videoNode, { x: 1851, y: 10 }],
    ]);
    const dimensions = new Map([
      [textNode, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
      [videoNode, { width: 480, height: 270 }],
    ]);
    const nodesById = new Map([
      [textNode, node(textNode, AI_TEXT_NODE_TYPE)],
      [videoNode, node(videoNode, AI_VIDEO_NODE_TYPE)],
    ]);

    enforceGenerativeColumnGapPushUp(positions, dimensions, nodesById);

    expect(positions.get(textNode)?.y).toBe(400);
    expect(positions.get(videoNode)?.y).toBe(10);
  });
});

describe("applyWorkflowLayoutPostprocess", () => {
  it("runs push-up then snap with column-gap rollback", () => {
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

  it("rolls back snap when it would break same-column spacing", () => {
    const upperText = "ai-text-upper";
    const lowerText = "ai-text-lower";
    const image = "ai-image-right";

    const positions = new Map([
      [upperText, { x: 643, y: 100 }],
      [lowerText, { x: 643, y: 250 }],
      [image, { x: 1100, y: 0 }],
    ]);
    const dimensions = new Map([
      [upperText, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
      [lowerText, { width: 360, height: AI_TEXT_CARD_HEIGHT_PX }],
      [image, { width: 272, height: 272 }],
    ]);
    const nodesById = new Map([
      [upperText, node(upperText, AI_TEXT_NODE_TYPE)],
      [lowerText, node(lowerText, AI_TEXT_NODE_TYPE)],
      [image, node(image, AI_IMAGE_NODE_TYPE)],
    ]);
    const lowerYBefore = positions.get(lowerText)?.y ?? 0;
    const edges = [
      {
        id: "kw",
        source: image,
        target: lowerText,
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      },
    ] as ReactFlowEdge<WorkflowEdgeType>[];

    applyWorkflowLayoutPostprocess(positions, dimensions, edges, nodesById);

    expect(positions.get(upperText)?.y).toBe(100);
    expect(positions.get(lowerText)?.y).toBe(lowerYBefore);
  });
});
