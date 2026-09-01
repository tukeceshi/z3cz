import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
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
import { AI_VIDEO_CARD_HEIGHT_PX, AI_VIDEO_CARD_WIDTH_PX } from "./ai-video-node-utils";

describe("generative-node-content-geometry", () => {
  it("documents floating title offset outside the content card", () => {
    expect(GENERATIVE_NODE_TITLE_OFFSET_PX).toBe(20);
  });

  it("snaps saved layout onto the layout grid", () => {
    expect(
      resolveGenerativeLayoutContentSize(AI_VIDEO_NODE_TYPE, {
        data: { metadata: { layoutWidth: "479", layoutHeight: "270" } },
      })
    ).toEqual({ width: 480, height: 264 });
  });

  it("prefers persisted metadata layout over type defaults", () => {
    expect(
      resolveGenerativeLayoutContentSize(AI_IMAGE_NODE_TYPE, {
        measured: { width: 400, height: 300 },
        data: { metadata: { layoutWidth: "528", layoutHeight: "264" } },
      })
    ).toEqual({ width: 528, height: 264 });
  });

  it("ignores measured chrome for image/video card size", () => {
    const node = {
      id: "img-1",
      data: { nodeType: AI_IMAGE_NODE_TYPE },
      measured: { width: 400, height: 300 },
      internals: { positionAbsolute: { x: 10, y: 20 } },
    } as InternalNode<Node>;

    expect(resolveGenerativeNodeContentSize(node)).toEqual({
      width: AI_IMAGE_CARD_WIDTH_PX,
      height: AI_IMAGE_CARD_HEIGHT_PX,
    });
    expect(snapGenerativeContentBorderPoint(node, "left")).toEqual({
      x: 10,
      y: 20 + AI_IMAGE_CARD_HEIGHT_PX / 2,
    });
    expect(snapGenerativeContentBorderPoint(node, "right")).toEqual({
      x: 10 + AI_IMAGE_CARD_WIDTH_PX,
      y: 20 + AI_IMAGE_CARD_HEIGHT_PX / 2,
    });
  });

  it("falls back to type defaults without layout metadata", () => {
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

  it("snaps video edges to the same card midpoint when only one side has layout", () => {
    const source = {
      id: "video-source",
      data: {
        nodeType: AI_VIDEO_NODE_TYPE,
        metadata: { layoutWidth: "468", layoutHeight: "264" },
      },
      measured: { width: 482, height: 277 },
      internals: { positionAbsolute: { x: 360, y: -1176 } },
    } as InternalNode<Node>;
    const target = {
      id: "video-target",
      data: { nodeType: AI_VIDEO_NODE_TYPE },
      measured: { width: 482, height: 277 },
      internals: { positionAbsolute: { x: 1032, y: -1176 } },
    } as InternalNode<Node>;

    expect(resolveGenerativeLayoutContentSize(AI_VIDEO_NODE_TYPE, source)).toEqual({
      width: 468,
      height: 264,
    });
    expect(resolveGenerativeLayoutContentSize(AI_VIDEO_NODE_TYPE, target)).toEqual({
      width: AI_VIDEO_CARD_WIDTH_PX,
      height: AI_VIDEO_CARD_HEIGHT_PX,
    });

    const sourceRight = snapGenerativeContentBorderPoint(source, "right");
    const targetLeft = snapGenerativeContentBorderPoint(target, "left");
    expect(sourceRight.y).toBe(targetLeft.y);
    expect(sourceRight.y).toBe(-1176 + AI_VIDEO_CARD_HEIGHT_PX / 2);
    expect(sourceRight.x).toBe(360 + 468);
    expect(targetLeft.x).toBe(1032);
  });
});
