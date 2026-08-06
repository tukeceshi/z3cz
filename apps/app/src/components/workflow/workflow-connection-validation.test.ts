import { AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import { describe, expect, it } from "vitest";
import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from "@xyflow/react";

import { AI_IMAGE_OUTPUT_ID } from "./ai-image-node-utils";
import { AI_VIDEO_REFERENCE_HANDLE_ID } from "./ai-video-node-utils";
import { AI_TEXT_KEYWORDS_HANDLE_ID, AI_TEXT_OUTPUT_ID } from "./ai-text-node-utils";
import {
  edgeTouchesInputHandle,
  resolveConnectionEndpoints,
  validateWorkflowConnection,
} from "./workflow-connection-validation";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

function makeNode(
  id: string,
  overrides: Partial<WorkflowNodeType> & Pick<WorkflowNodeType, "nodeType">
): ReactFlowNode<WorkflowNodeType> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {
      name: id,
      inputs: [],
      outputs: [],
      ...overrides,
    },
  };
}

describe("workflow connection output fan-out", () => {
  const source = makeNode("text-1", {
    nodeType: "ai-text",
    outputs: [{ id: AI_TEXT_OUTPUT_ID, name: AI_TEXT_OUTPUT_ID, type: "string" }],
  });

  const targetA = makeNode("text-2", {
    nodeType: "ai-text",
    inputs: [],
  });

  const targetB = makeNode("text-3", {
    nodeType: "ai-text",
    inputs: [],
  });

  const nodes = [source, targetA, targetB];

  const existingEdge: ReactFlowEdge<WorkflowEdgeType> = {
    id: "e1",
    source: "text-1",
    target: "text-2",
    sourceHandle: AI_TEXT_OUTPUT_ID,
    targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
  };

  it("allows the same output to connect to a second target", () => {
    const ok = validateWorkflowConnection({
      connection: {
        source: "text-1",
        target: "text-3",
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      },
      nodes,
      edges: [existingEdge],
    });
    expect(ok).toBe(true);
  });

  it("still blocks a second edge into a non-repeated input", () => {
    const imageA = makeNode("image-1", {
      nodeType: "ai-image",
      inputs: [
        {
          id: "prompt_reference",
          name: "prompt_reference",
          type: "any",
          repeated: false,
        },
      ],
    });

    const ok = validateWorkflowConnection({
      connection: {
        source: "text-1",
        target: "image-1",
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetHandle: "prompt_reference",
      },
      nodes: [source, imageA],
      edges: [
        {
          id: "e-prompt",
          source: "text-1",
          target: "image-1",
          sourceHandle: AI_TEXT_OUTPUT_ID,
          targetHandle: "prompt_reference",
        },
      ],
    });
    expect(ok).toBe(false);
  });

  it("resolves virtual input handles for endpoint detection", () => {
    const endpoints = resolveConnectionEndpoints(
      {
        source: "text-1",
        target: "text-2",
        sourceHandle: AI_TEXT_OUTPUT_ID,
        targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
      },
      source,
      targetA
    );
    expect(endpoints?.inputNodeId).toBe("text-2");
    expect(endpoints?.inputHandleId).toBe(AI_TEXT_KEYWORDS_HANDLE_ID);
    expect(endpoints?.inputParam.repeated).toBe(true);
    expect(endpoints?.outputNodeId).toBe("text-1");
  });

  it("edgeTouchesInputHandle matches only edges on that input", () => {
    expect(
      edgeTouchesInputHandle(existingEdge, "text-2", AI_TEXT_KEYWORDS_HANDLE_ID)
    ).toBe(true);
    expect(
      edgeTouchesInputHandle(existingEdge, "text-3", AI_TEXT_KEYWORDS_HANDLE_ID)
    ).toBe(false);
  });
});

describe("validateWorkflowConnection generative catalogs", () => {
  it("prefers live video catalog over stale metadata snapshot", () => {
    const imageA = makeNode("img-1", {
      nodeType: "ai-image",
      outputs: [{ id: AI_IMAGE_OUTPUT_ID, name: AI_IMAGE_OUTPUT_ID, type: "image" }],
    });
    const imageB = makeNode("img-2", {
      nodeType: "ai-image",
      outputs: [{ id: AI_IMAGE_OUTPUT_ID, name: AI_IMAGE_OUTPUT_ID, type: "image" }],
    });
    const imageC = makeNode("img-3", {
      nodeType: "ai-image",
      outputs: [{ id: AI_IMAGE_OUTPUT_ID, name: AI_IMAGE_OUTPUT_ID, type: "image" }],
    });
    const video = makeNode("video-1", {
      nodeType: AI_VIDEO_NODE_TYPE,
      inputs: [{ id: "model", name: "model", type: "string", value: "seedance-fast" }],
      metadata: {
        refMaxImages: "2",
        refMaxVideos: "1",
        refMaxAudios: "3",
      },
    });

    const edges: ReactFlowEdge<WorkflowEdgeType>[] = [
      {
        id: "e1",
        source: "img-1",
        target: "video-1",
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
      },
      {
        id: "e2",
        source: "img-2",
        target: "video-1",
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
      },
    ];

    const withoutCatalog = validateWorkflowConnection({
      connection: {
        source: "img-3",
        target: "video-1",
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
      },
      nodes: [imageA, imageB, imageC, video],
      edges,
    });
    expect(withoutCatalog).toBe(false);

    const withCatalog = validateWorkflowConnection({
      connection: {
        source: "img-3",
        target: "video-1",
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
      },
      nodes: [imageA, imageB, imageC, video],
      edges,
      generativeReferenceCatalogs: {
        imageModels: [],
        videoModels: [
          {
            canonicalId: "seedance-fast",
            parameterRules: {
              schemaVersion: 1,
              maxReferenceImages: 9,
              maxImageReferenceBytes: 1,
              maxReferenceVideos: 1,
              maxVideoReferenceBytes: 1,
              maxVideoReferenceSeconds: 1,
              maxReferenceAudios: 3,
              maxAudioReferenceBytes: 1,
              maxAudioReferenceSeconds: 1,
              promptMaxChars: 1000,
              generationFields: [],
            },
          },
        ],
      },
    });
    expect(withCatalog).toBe(true);
  });
});
