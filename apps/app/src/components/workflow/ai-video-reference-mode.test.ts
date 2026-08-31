import {
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
  withAiVideoPanelKind,
} from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import { AI_IMAGE_OUTPUT_ID } from "./ai-image-node-utils";
import {
  AI_VIDEO_OUTPUT_ID,
  AI_VIDEO_REFERENCE_HANDLE_ID,
} from "./ai-video-node-utils";
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

  it("reserves one video reference slot for retake panel nodes", () => {
    const targetNodeData: WorkflowNodeType = {
      nodeType: AI_VIDEO_NODE_TYPE,
      name: "retake",
      inputs: [{ id: "model", value: "seedance" }],
      outputs: [],
      metadata: withAiVideoPanelKind(
        {
          refMaxImages: "4",
          refMaxVideos: "1",
          refMaxAudios: "0",
        },
        "retake"
      ),
    };

    const verdict = evaluateAiVideoReferenceStructural({
      targetNodeId: "video-retake-1",
      sourceNodeId: "video-src",
      sourceHandle: AI_VIDEO_OUTPUT_ID,
      sourceNodeType: AI_VIDEO_NODE_TYPE,
      targetNodeData,
      edges: [],
      nodes: [
        { id: "video-retake-1", data: targetNodeData },
        {
          id: "video-src",
          data: {
            nodeType: AI_VIDEO_NODE_TYPE,
            name: "source",
            inputs: [],
            outputs: [],
          },
        },
      ],
    });

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe("video_limit");
    }
  });

  it("allows canvas video on retake when model rules permit after trim reservation", () => {
    const targetNodeData: WorkflowNodeType = {
      nodeType: AI_VIDEO_NODE_TYPE,
      name: "retake",
      inputs: [
        { id: "model", value: "doubao-seedance-2-5" },
        { id: "ai_interface_id", value: "iface-seedance" },
      ],
      outputs: [],
      metadata: withAiVideoPanelKind(
        {
          refMaxImages: "4",
          refMaxVideos: "3",
          refMaxAudios: "0",
        },
        "retake"
      ),
    };

    const verdict = evaluateAiVideoReferenceStructural({
      targetNodeId: "video-retake-1",
      sourceNodeId: "video-src",
      sourceHandle: AI_VIDEO_OUTPUT_ID,
      sourceNodeType: AI_VIDEO_NODE_TYPE,
      targetNodeData,
      edges: [],
      nodes: [
        { id: "video-retake-1", data: targetNodeData },
        {
          id: "video-src",
          data: {
            nodeType: AI_VIDEO_NODE_TYPE,
            name: "source",
            inputs: [],
            outputs: [],
          },
        },
      ],
      models: [
        {
          canonicalId: "doubao-seedance-2-5",
          parameterRules: {
            ...DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
            maxReferenceVideos: 3,
          },
        },
      ],
    });

    expect(verdict.ok).toBe(true);
  });

  it("does not reserve a video slot for normal video nodes", () => {
    const targetNodeData: WorkflowNodeType = {
      nodeType: AI_VIDEO_NODE_TYPE,
      name: "video",
      inputs: [{ id: "model", value: "seedance" }],
      outputs: [],
      metadata: {
        refMaxImages: "4",
        refMaxVideos: "1",
        refMaxAudios: "0",
      },
    };

    const verdict = evaluateAiVideoReferenceStructural({
      targetNodeId: "video-1",
      sourceNodeId: "video-src",
      sourceHandle: AI_VIDEO_OUTPUT_ID,
      sourceNodeType: AI_VIDEO_NODE_TYPE,
      targetNodeData,
      edges: [],
      nodes: [
        { id: "video-1", data: targetNodeData },
        {
          id: "video-src",
          data: {
            nodeType: AI_VIDEO_NODE_TYPE,
            name: "source",
            inputs: [],
            outputs: [],
          },
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
        sourceNodeId: "n1",
        kind: "image",
        label: "A",
      },
      {
        edgeId: "e2",
        sourceNodeId: "n2",
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
