import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE, AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import type { InternalNode, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { AI_IMAGE_OUTPUT_ID } from "./ai-image-node-utils";
import {
  resolveAiTextEdgeAnchors,
  snapAiTextKeywordsBorderPoint,
  snapAiTextOutputBorderPoint,
} from "./ai-text-connection-utils";
import {
  AI_TEXT_CARD_WIDTH_PX,
  AI_TEXT_KEYWORDS_HANDLE_ID,
} from "./ai-text-node-utils";
import { AI_VIDEO_REFERENCE_HANDLE_ID } from "./ai-video-node-utils";

function mockTextNode(
  id: string,
  position: { readonly x: number; readonly y: number }
): InternalNode<Node> {
  return {
    id,
    data: { nodeType: AI_TEXT_NODE_TYPE },
    internals: { positionAbsolute: position },
  } as InternalNode<Node>;
}

function mockImageNode(
  id: string,
  position: { readonly x: number; readonly y: number },
  measured?: { readonly width: number; readonly height: number }
): InternalNode<Node> {
  return {
    id,
    data: { nodeType: AI_IMAGE_NODE_TYPE },
    measured,
    internals: { positionAbsolute: position },
  } as InternalNode<Node>;
}

function mockVideoNode(
  id: string,
  position: { readonly x: number; readonly y: number },
  measured?: { readonly width: number; readonly height: number }
): InternalNode<Node> {
  return {
    id,
    data: { nodeType: AI_VIDEO_NODE_TYPE },
    measured,
    internals: { positionAbsolute: position },
  } as InternalNode<Node>;
}

describe("ai-text-connection-utils", () => {
  it("anchors keywords on the left border and output on the right", () => {
    const node = mockTextNode("text-1", { x: 100, y: 40 });
    const keywords = snapAiTextKeywordsBorderPoint(node);
    const output = snapAiTextOutputBorderPoint(node);

    expect(keywords.x).toBe(100);
    expect(output.x).toBe(100 + AI_TEXT_CARD_WIDTH_PX);
    expect(keywords.x).toBeLessThan(output.x);
  });

  it("snaps image to text inbound edges on the text left border", () => {
    const source = mockImageNode("image-1", { x: 0, y: 0 });
    const target = mockTextNode("text-1", { x: 500, y: 0 });
    const nodeLookup = new Map<string, InternalNode<Node>>([
      [source.id, source],
      [target.id, target],
    ]);

    const anchors = resolveAiTextEdgeAnchors({
      sourceX: 0,
      sourceY: 0,
      targetX: 999,
      targetY: 999,
      source: source.id,
      target: target.id,
      sourceHandle: AI_IMAGE_OUTPUT_ID,
      targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      nodeLookup,
    });

    const keywords = snapAiTextKeywordsBorderPoint(target);
    const output = snapAiTextOutputBorderPoint(target);

    expect(anchors.targetX).toBe(keywords.x);
    expect(anchors.targetY).toBe(keywords.y);
    expect(anchors.targetX).not.toBe(output.x);
  });

  it("snaps image to video on content midpoints using measured size", () => {
    const source = mockImageNode("image-1", { x: 0, y: 100 }, {
      width: 272,
      height: 277,
    });
    const target = mockVideoNode("video-1", { x: 500, y: 100 }, {
      width: 472,
      height: 277,
    });
    const nodeLookup = new Map<string, InternalNode<Node>>([
      [source.id, source],
      [target.id, target],
    ]);

    const anchors = resolveAiTextEdgeAnchors({
      sourceX: 0,
      sourceY: 0,
      targetX: 999,
      targetY: 999,
      source: source.id,
      target: target.id,
      sourceHandle: AI_IMAGE_OUTPUT_ID,
      targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
      nodeLookup,
    });

    expect(anchors.sourceY).toBe(100 + 277 / 2);
    expect(anchors.targetY).toBe(100 + 277 / 2);
    expect(anchors.sourceX).toBe(272);
    expect(anchors.targetX).toBe(500);
  });
});
