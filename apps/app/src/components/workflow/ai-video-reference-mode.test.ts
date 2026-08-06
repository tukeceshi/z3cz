import {
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
} from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import { AI_IMAGE_OUTPUT_ID } from "./ai-image-node-utils";
import { AI_VIDEO_REFERENCE_HANDLE_ID } from "./ai-video-node-utils";
import {
  annotateVideoReferenceChips,
  buildVideoReferenceModeSwitchPatch,
  resolveEffectiveVideoReferenceMode,
  resetReferenceModeAutoSwitchNoticesForNode,
  shouldAutoSwitchVideoReferenceMode,
  shouldShowReferenceModeAutoSwitchNotice,
  syncVideoReferenceModeIfNeeded,
} from "./ai-video-reference-mode";
import { evaluateAiVideoReferenceStructural } from "./ai-video-reference-policy";
import type { GenerativeReferenceChip } from "./generative-reference-utils";
import type { WorkflowNodeType } from "./workflow-types";

describe("shouldShowReferenceModeAutoSwitchNotice", () => {
  it("shows at most once per node and reference count signature", () => {
    resetReferenceModeAutoSwitchNoticesForNode("video-1");
    const counts = { imageCount: 3, videoCount: 0, audioCount: 0 };

    expect(shouldShowReferenceModeAutoSwitchNotice("video-1", counts)).toBe(true);
    expect(shouldShowReferenceModeAutoSwitchNotice("video-1", counts)).toBe(false);

    resetReferenceModeAutoSwitchNoticesForNode("video-1");
    expect(shouldShowReferenceModeAutoSwitchNotice("video-1", counts)).toBe(true);
  });
});

describe("shouldAutoSwitchVideoReferenceMode", () => {
  it("switches when first_last_frame references break frame pairing", () => {
    expect(
      shouldAutoSwitchVideoReferenceMode("first_last_frame", {
        imageCount: 3,
        videoCount: 0,
        audioCount: 0,
      })
    ).toBe(true);
    expect(
      shouldAutoSwitchVideoReferenceMode("first_last_frame", {
        imageCount: 1,
        videoCount: 1,
        audioCount: 0,
      })
    ).toBe(true);
    expect(
      shouldAutoSwitchVideoReferenceMode("first_last_frame", {
        imageCount: 2,
        videoCount: 0,
        audioCount: 0,
      })
    ).toBe(false);
  });
});

describe("syncVideoReferenceModeIfNeeded", () => {
  it("writes reference_image into params and metadata", () => {
    const nodeData: WorkflowNodeType = {
      nodeType: AI_VIDEO_NODE_TYPE,
      name: "video",
      inputs: [
        {
          id: "params",
          value: { reference_mode: "first_last_frame" },
        },
      ],
      outputs: [],
      metadata: { refReferenceMode: "first_last_frame" },
    };

    const patch = syncVideoReferenceModeIfNeeded({
      nodeData,
      targetNodeId: "video-1",
      edges: [
        {
          source: "img-1",
          target: "video-1",
          sourceHandle: AI_IMAGE_OUTPUT_ID,
          targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
        },
        {
          source: "img-2",
          target: "video-1",
          sourceHandle: AI_IMAGE_OUTPUT_ID,
          targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
        },
        {
          source: "img-3",
          target: "video-1",
          sourceHandle: AI_IMAGE_OUTPUT_ID,
          targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
        },
      ],
      nodes: [
        { id: "video-1", data: nodeData },
        {
          id: "img-1",
          data: { nodeType: AI_IMAGE_NODE_TYPE, name: "a", inputs: [], outputs: [] },
        },
        {
          id: "img-2",
          data: { nodeType: AI_IMAGE_NODE_TYPE, name: "b", inputs: [], outputs: [] },
        },
        {
          id: "img-3",
          data: { nodeType: AI_IMAGE_NODE_TYPE, name: "c", inputs: [], outputs: [] },
        },
      ],
    });

    expect(patch?.metadata?.refReferenceMode).toBe("reference_image");
    const params = patch?.inputs?.find((input) => input.id === "params")?.value;
    expect(params).toMatchObject({ reference_mode: "reference_image" });
  });
});

describe("evaluateAiVideoReferenceStructural", () => {
  it("allows a third image while first_last_frame metadata is set", () => {
    const targetNodeData: WorkflowNodeType = {
      nodeType: AI_VIDEO_NODE_TYPE,
      name: "video",
      inputs: [{ id: "model", value: "custom-video" }],
      outputs: [],
      metadata: {
        refMaxImages: "4",
        refMaxVideos: "1",
        refMaxAudios: "3",
        refReferenceMode: "first_last_frame",
      },
    };
    const edges = [
      {
        source: "img-1",
        target: "video-1",
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
      },
      {
        source: "img-2",
        target: "video-1",
        sourceHandle: AI_IMAGE_OUTPUT_ID,
        targetHandle: AI_VIDEO_REFERENCE_HANDLE_ID,
      },
    ];

    const verdict = evaluateAiVideoReferenceStructural({
      targetNodeId: "video-1",
      sourceNodeId: "img-3",
      sourceHandle: AI_IMAGE_OUTPUT_ID,
      sourceNodeType: AI_IMAGE_NODE_TYPE,
      targetNodeData,
      edges,
      nodes: [
        { id: "video-1", data: targetNodeData },
        {
          id: "img-1",
          data: { nodeType: AI_IMAGE_NODE_TYPE, name: "a", inputs: [], outputs: [] },
        },
        {
          id: "img-2",
          data: { nodeType: AI_IMAGE_NODE_TYPE, name: "b", inputs: [], outputs: [] },
        },
        {
          id: "img-3",
          data: { nodeType: AI_IMAGE_NODE_TYPE, name: "c", inputs: [], outputs: [] },
        },
      ],
    });

    expect(verdict.ok).toBe(true);
  });
});

describe("annotateVideoReferenceChips", () => {
  it("labels the first two image chips in first_last_frame mode", () => {
    const chips: GenerativeReferenceChip[] = [
      {
        edgeId: "e1",
        kind: "image",
        label: "A",
      },
      {
        edgeId: "e2",
        kind: "image",
        label: "B",
      },
    ];

    const annotated = annotateVideoReferenceChips(
      chips,
      "first_last_frame",
      { imageCount: 2, videoCount: 0, audioCount: 0 },
      { firstFrame: "First", lastFrame: "Last" }
    );

    expect(annotated[0]?.overlayLabel).toBe("First");
    expect(annotated[1]?.overlayLabel).toBe("Last");
  });
});

describe("resolveEffectiveVideoReferenceMode", () => {
  it("prefers params over metadata", () => {
    const nodeData: WorkflowNodeType = {
      nodeType: AI_VIDEO_NODE_TYPE,
      name: "video",
      inputs: [{ id: "params", value: { reference_mode: "reference_image" } }],
      outputs: [],
      metadata: { refReferenceMode: "first_last_frame" },
    };

    expect(
      resolveEffectiveVideoReferenceMode(
        nodeData,
        DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
        { reference_mode: "reference_image" }
      )
    ).toBe("reference_image");
  });
});

describe("buildVideoReferenceModeSwitchPatch", () => {
  it("preserves other generation params", () => {
    const current: WorkflowNodeType = {
      nodeType: AI_VIDEO_NODE_TYPE,
      name: "video",
      inputs: [
        {
          id: "params",
          value: { reference_mode: "first_last_frame", duration: 5 },
        },
      ],
      outputs: [],
    };

    const patch = buildVideoReferenceModeSwitchPatch(current);
    const params = patch.inputs?.find((input) => input.id === "params")?.value;

    expect(params).toMatchObject({
      reference_mode: "reference_image",
      duration: 5,
    });
  });
});
