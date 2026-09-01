import { AI_VIDEO_NODE_TYPE } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import { AI_VIDEO_REFERENCE_HANDLE_ID } from "./ai-video-node-utils";
import {
  annotateRetakePrimaryVideoChips,
  isRetakePrimaryVideoEdge,
  resolveRetakePrimaryVideoRef,
} from "./ai-video-retake-primary-ref";
import type { GenerativeReferenceChip } from "./generative-reference-utils";
import type { WorkflowNodeType } from "./workflow-types";

const sourceVideo: WorkflowNodeType = {
  name: "Source",
  nodeType: AI_VIDEO_NODE_TYPE,
  icon: "video",
  inputs: [],
  outputs: [
    {
      id: "videos",
      name: "videos",
      type: "json",
      value: [
        {
          kind: "cloud",
          resourceId: "res-source",
          mimeType: "video/mp4",
        },
      ],
    },
  ],
  executionState: "idle",
  createObjectUrl: () => "blob:source",
};

const retakeNode: WorkflowNodeType = {
  name: "Retake",
  nodeType: AI_VIDEO_NODE_TYPE,
  icon: "video",
  inputs: [
    {
      id: "retake_draft",
      name: "retake_draft",
      type: "json",
      hidden: true,
      value: {
        committedRange: { startSec: 0, endSec: 4 },
        draftRange: { startSec: 0, endSec: 4 },
        loadPhase: "ready",
        cardPreview: "source",
        primaryVideoEdgeId: "edge-primary",
        primaryVideoMediaKey: null,
        highQuality: false,
        playbackPaused: false,
        selectedModelOptionId: null,
        generationParams: {},
        resolutionManuallySet: false,
        videoDurationSec: 10,
        sourceVideoWidth: null,
        sourceVideoHeight: null,
      },
    },
  ],
  outputs: [{ id: "videos", name: "videos", type: "json" }],
  executionState: "idle",
  createObjectUrl: () => "blob:retake",
  metadata: {
    aiVideoPanel: JSON.stringify({ kind: "retake" }),
  },
};

describe("resolveRetakePrimaryVideoRef", () => {
  const nodes = [
    { id: "source", data: sourceVideo },
    { id: "retake", data: retakeNode },
  ];
  const edges = [
    {
      id: "edge-primary",
      source: "source",
      target: "retake",
      sourceHandle: "videos",
      targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
    },
    {
      id: "edge-extra",
      source: "source",
      target: "retake",
      sourceHandle: "videos",
      targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
    },
  ];

  it("prefers draft.primaryVideoEdgeId over list order", () => {
    const resolved = resolveRetakePrimaryVideoRef({
      targetNodeId: "retake",
      edges,
      nodes,
      inputs: retakeNode.inputs,
    });
    expect(resolved?.edgeId).toBe("edge-primary");
    expect(resolved?.media).toMatchObject({ resourceId: "res-source" });
  });

  it("falls back to the first video reference chip", () => {
    const resolved = resolveRetakePrimaryVideoRef({
      targetNodeId: "retake",
      edges,
      nodes,
      inputs: retakeNode.inputs.map((input) =>
        input.id === "retake_draft"
          ? {
              ...input,
              value: {
                ...(input.value as Record<string, unknown>),
                primaryVideoEdgeId: null,
              },
            }
          : input
      ),
    });
    expect(resolved?.edgeId).toBe("edge-primary");
  });
});

describe("isRetakePrimaryVideoEdge", () => {
  it("matches the resolved primary edge only", () => {
    expect(
      isRetakePrimaryVideoEdge({
        edgeId: "edge-primary",
        targetNodeId: "retake",
        edges: [
          {
            id: "edge-primary",
            source: "source",
            target: "retake",
            sourceHandle: "videos",
            targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
          },
        ],
        nodes: [
          { id: "source", data: sourceVideo },
          { id: "retake", data: retakeNode },
        ],
        inputs: retakeNode.inputs,
      })
    ).toBe(true);
    expect(
      isRetakePrimaryVideoEdge({
        edgeId: "edge-other",
        targetNodeId: "retake",
        edges: [
          {
            id: "edge-primary",
            source: "source",
            target: "retake",
            sourceHandle: "videos",
            targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
          },
        ],
        nodes: [
          { id: "source", data: sourceVideo },
          { id: "retake", data: retakeNode },
        ],
        inputs: retakeNode.inputs,
      })
    ).toBe(false);
  });
});

describe("annotateRetakePrimaryVideoChips", () => {
  it("marks the primary chip as locked with overlay label", () => {
    const chips: GenerativeReferenceChip[] = [
      {
        edgeId: "edge-primary",
        sourceNodeId: "source",
        kind: "video",
        label: "Source",
      },
      {
        edgeId: "edge-extra",
        sourceNodeId: "source",
        kind: "video",
        label: "Extra",
      },
    ];
    const annotated = annotateRetakePrimaryVideoChips({
      chips,
      primaryEdgeId: "edge-primary",
      sourceLabel: "原片",
    });
    expect(annotated[0]).toMatchObject({
      overlayLabel: "原片",
      disconnectable: false,
    });
    expect(annotated[1]?.disconnectable).toBeUndefined();
  });
});
