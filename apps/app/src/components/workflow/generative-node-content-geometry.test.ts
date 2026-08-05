import { AI_IMAGE_NODE_TYPE, AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import type { InternalNode, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
  resolveGenerativeLayoutContentSize,
  resolveGenerativeNodeContentSize,
  GENERATIVE_NODE_TITLE_OFFSET_PX,
  snapGenerativeContentBorderPoint,
} from "./generative-node-content-geometry";
import { AI_IMAGE_CARD_HEIGHT_PX, AI_IMAGE_CARD_WIDTH_PX } from "./ai-image-node-utils";
import { AI_TEXT_CARD_HEIGHT_PX, AI_TEXT_CARD_WIDTH_PX } from "./ai-text-node-utils";

describe("generative-node-content-geometry", () => {
  it("documents floating title offset outside the content card", () => {
    expect(GENERATIVE_NODE_TITLE_OFFSET_PX).toBe(20);
  });

  it("uses measured content size when present", () => {
    const node = {
      id: "img-1",
      data: { nodeType: AI_IMAGE_NODE_TYPE },
      measured: { width: 400, height: 300 },
      internals: { positionAbsolute: { x: 10, y: 20 } },
    } as InternalNode<Node>;

    expect(resolveGenerativeNodeContentSize(node)).toEqual({
      width: 400,
      height: 300,
    });
    expect(snapGenerativeContentBorderPoint(node, "left")).toEqual({
      x: 10,
      y: 170,
    });
    expect(snapGenerativeContentBorderPoint(node, "right")).toEqual({
      x: 410,
      y: 170,
    });
  });

  it("falls back to type defaults without measured size", () => {
    const text = {
      id: "text-1",
      data: { nodeType: AI_TEXT_NODE_TYPE },
      internals: { positionAbsolute: { x: 0, y: 0 } },
    } as InternalNode<Node>;
    const image = {
      id: "img-1",
      data: { nodeType: AI_IMAGE_NODE_TYPE },
      internals: { positionAbsolute: { x: 0, y: 0 } },
    } as InternalNode<Node>;

    expect(resolveGenerativeLayoutContentSize(AI_TEXT_NODE_TYPE)).toEqual({
      width: AI_TEXT_CARD_WIDTH_PX,
      height: AI_TEXT_CARD_HEIGHT_PX,
    });
    expect(resolveGenerativeNodeContentSize(text)).toEqual({
      width: AI_TEXT_CARD_WIDTH_PX,
      height: AI_TEXT_CARD_HEIGHT_PX,
    });
    expect(resolveGenerativeNodeContentSize(image)).toEqual({
      width: AI_IMAGE_CARD_WIDTH_PX,
      height: AI_IMAGE_CARD_HEIGHT_PX,
    });
  });

  it("ignores measured border drift for ai-text layout size", () => {
    expect(
      resolveGenerativeLayoutContentSize(AI_TEXT_NODE_TYPE, {
        measured: { width: 360, height: 199 },
      })
    ).toEqual({
      width: AI_TEXT_CARD_WIDTH_PX,
      height: AI_TEXT_CARD_HEIGHT_PX,
    });
  });
});
