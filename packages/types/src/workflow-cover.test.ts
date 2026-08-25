import { describe, expect, it } from "vitest";

import { AI_IMAGE_NODE_TYPE } from "./ai-interface";
import {
  AI_IMAGE_HISTORY_INPUT,
  AI_IMAGE_RESULT_INPUT,
} from "./generative-node-content";
import { nodeLayoutMetadataEntries } from "./node-layout-metadata";
import { findFirstWorkflowCoverCandidate } from "./workflow-cover";
import type { Node } from "./workflow";

const wideLayout = nodeLayoutMetadataEntries({ width: 540, height: 270 });
const portraitLayout = nodeLayoutMetadataEntries({ width: 270, height: 480 });
const squareLayout = nodeLayoutMetadataEntries({ width: 270, height: 270 });

function createImageNode(
  inputs: Node["inputs"] = [],
  metadata?: Node["metadata"]
): Node {
  return {
    id: "node-1",
    name: "Image",
    type: AI_IMAGE_NODE_TYPE,
    position: { x: 0, y: 0 },
    metadata,
    inputs,
    outputs: [{ name: "images", type: "json", value: [] }],
  };
}

describe("findFirstWorkflowCoverCandidate", () => {
  it("returns the first ready image on a wide-layout node", () => {
    const node = createImageNode(
      [
        {
          name: AI_IMAGE_RESULT_INPUT,
          type: "json",
          value: [
            {
              resourceId: "img-1",
              mimeType: "image/png",
              kind: "cloud",
            },
          ],
        },
      ],
      wideLayout
    );

    expect(findFirstWorkflowCoverCandidate([node])).toEqual({
      resourceId: "img-1",
      mimeType: "image/png",
    });
  });

  it("returns null when layout is portrait", () => {
    const node = createImageNode(
      [
        {
          name: AI_IMAGE_RESULT_INPUT,
          type: "json",
          value: [
            {
              resourceId: "img-1",
              mimeType: "image/png",
              kind: "cloud",
            },
          ],
        },
      ],
      portraitLayout
    );

    expect(findFirstWorkflowCoverCandidate([node])).toBeNull();
  });

  it("returns null when layout is square", () => {
    const node = createImageNode(
      [
        {
          name: AI_IMAGE_RESULT_INPUT,
          type: "json",
          value: [
            {
              resourceId: "img-1",
              mimeType: "image/png",
              kind: "cloud",
            },
          ],
        },
      ],
      squareLayout
    );

    expect(findFirstWorkflowCoverCandidate([node])).toBeNull();
  });

  it("returns null when layout metadata is missing", () => {
    const node = createImageNode([
      {
        name: AI_IMAGE_RESULT_INPUT,
        type: "json",
        value: [
          {
            resourceId: "img-1",
            mimeType: "image/png",
            kind: "cloud",
          },
        ],
      },
    ]);

    expect(findFirstWorkflowCoverCandidate([node])).toBeNull();
  });

  it("skips generating images and uses history on wide nodes", () => {
    const node = createImageNode(
      [
        {
          name: AI_IMAGE_RESULT_INPUT,
          type: "json",
          value: [
            {
              resourceId: "pending",
              mimeType: "image/png",
              generating: true,
            },
          ],
        },
        {
          name: AI_IMAGE_HISTORY_INPUT,
          type: "json",
          value: {
            selectedId: "hist-1",
            items: [
              {
                id: "hist-1",
                createdAt: "2026-01-01T00:00:00.000Z",
                images: [
                  {
                    resourceId: "done",
                    mimeType: "image/jpeg",
                    kind: "cloud",
                  },
                ],
              },
            ],
          },
        },
      ],
      wideLayout
    );

    expect(findFirstWorkflowCoverCandidate([node])).toEqual({
      resourceId: "done",
      mimeType: "image/jpeg",
    });
  });

  it("reads wide-layout image blob fields on non-generative nodes", () => {
    const node: Node = {
      id: "node-2",
      name: "Upload",
      type: "http_request",
      position: { x: 0, y: 0 },
      metadata: wideLayout,
      inputs: [
        {
          name: "photo",
          type: "image",
          value: { id: "obj-1", mimeType: "image/webp" },
        },
      ],
      outputs: [],
    };

    expect(findFirstWorkflowCoverCandidate([node])).toEqual({
      resourceId: "obj-1",
      mimeType: "image/webp",
    });
  });

  it("skips portrait nodes and picks the first wide node", () => {
    const portrait = createImageNode(
      [
        {
          name: AI_IMAGE_RESULT_INPUT,
          type: "json",
          value: [{ resourceId: "portrait", mimeType: "image/png", kind: "cloud" }],
        },
      ],
      portraitLayout
    );
    const wide = createImageNode(
      [
        {
          name: AI_IMAGE_RESULT_INPUT,
          type: "json",
          value: [{ resourceId: "wide", mimeType: "image/png", kind: "cloud" }],
        },
      ],
      wideLayout
    );

    expect(findFirstWorkflowCoverCandidate([portrait, wide])?.resourceId).toBe(
      "wide"
    );
  });

  it("returns null when every node is non-wide", () => {
    const portrait = createImageNode(
      [
        {
          name: AI_IMAGE_RESULT_INPUT,
          type: "json",
          value: [{ resourceId: "a", mimeType: "image/png", kind: "cloud" }],
        },
      ],
      portraitLayout
    );
    const square = createImageNode(
      [
        {
          name: AI_IMAGE_RESULT_INPUT,
          type: "json",
          value: [{ resourceId: "b", mimeType: "image/png", kind: "cloud" }],
        },
      ],
      squareLayout
    );

    expect(findFirstWorkflowCoverCandidate([portrait, square])).toBeNull();
  });
});
