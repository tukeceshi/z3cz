import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
} from "@dafthunk/types";
import type { InternalNode, Node } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_TEXT_OUTPUT_ID } from "./ai-text-node-utils";
import { findGenerativeConnectionHighlightTargetId } from "./generative-connection-highlight";
import { resolveGenerativePreviewConnection } from "./generative-connection-preview";

function mockTextNode(id: string): InternalNode<Node> {
  return {
    id,
    data: {
      nodeType: AI_TEXT_NODE_TYPE,
      outputs: [{ id: AI_TEXT_OUTPUT_ID, name: "text", type: "string" }],
      inputs: [],
    },
    internals: { positionAbsolute: { x: 0, y: 0 } },
  } as InternalNode<Node>;
}

function mockImageNode(id: string): InternalNode<Node> {
  return {
    id,
    data: {
      nodeType: AI_IMAGE_NODE_TYPE,
      inputs: [],
      outputs: [],
    },
    measured: { width: 280, height: 280 },
    internals: { positionAbsolute: { x: 400, y: 0 } },
  } as InternalNode<Node>;
}

function mockVideoNode(id: string): InternalNode<Node> {
  return {
    id,
    data: {
      nodeType: AI_VIDEO_NODE_TYPE,
      inputs: [],
      outputs: [],
    },
    measured: { width: 280, height: 280 },
    internals: { positionAbsolute: { x: 900, y: 0 } },
  } as InternalNode<Node>;
}

function mockNodeElement(id: string): Element {
  const el = {
    closest: (selector: string) =>
      selector === ".react-flow__node" ? el : null,
    getAttribute: (name: string) => (name === "data-id" ? id : null),
  };
  return el as unknown as Element;
}

describe("generative connection mid-card hit-test", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("highlights the image under the pointer, not a distant RF toNode video", () => {
    const text = mockTextNode("text-1");
    const image = mockImageNode("image-mid");
    const video = mockVideoNode("video-right");
    const nodeLookup = new Map<string, InternalNode<Node>>([
      [text.id, text],
      [image.id, image],
      [video.id, video],
    ]);

    const imageEl = mockNodeElement("image-mid");
    const videoEl = mockNodeElement("video-right");

    vi.stubGlobal("document", {
      elementsFromPoint: (x: number, y: number) => {
        if (x === 540 && y === 140) return [imageEl];
        if (x > 700) return [videoEl];
        return [];
      },
    });

    const domNode = {
      getBoundingClientRect: () =>
        ({
          left: 0,
          top: 0,
          right: 1200,
          bottom: 800,
          width: 1200,
          height: 800,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    } as HTMLDivElement;

    const connection = {
      inProgress: true,
      fromNode: text,
      fromHandle: { type: "source", id: AI_TEXT_OUTPUT_ID },
      to: { x: 540, y: 140 },
      pointer: { x: 540, y: 140 },
      // RF handle proximity incorrectly snaps toward the right card
      toNode: video,
    };

    const context = {
      domNode,
      transform: [0, 0, 1] as const,
    };

    const preview = resolveGenerativePreviewConnection(
      connection,
      nodeLookup,
      context,
      []
    );
    expect(preview?.connection.target).toBe("image-mid");
    expect(preview?.connection.target).not.toBe("video-right");

    const highlightId = findGenerativeConnectionHighlightTargetId(
      connection,
      context,
      nodeLookup,
      []
    );
    expect(highlightId).toBe("image-mid");
  });
});
