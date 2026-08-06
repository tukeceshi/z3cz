import {
  AI_IMAGE_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  DEFAULT_IMAGE_MODEL_PARAMETER_RULES,
  DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
  buildOrgModelOptionId,
  type OrgImageModelOption,
  type OrgVideoModelOption,
} from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  evaluateAiVideoReferenceStructural,
} from "./ai-video-reference-policy";
import { AI_IMAGE_OUTPUT_ID } from "./ai-image-node-utils";
import { AI_VIDEO_REFERENCE_HANDLE_ID } from "./ai-video-node-utils";
import {
  applyModelBindingToNodeData,
  generativeModelBindingHandlersForModality,
} from "./generative-model-binding";
import {
  generativeReferenceMetadataForModel,
  parseNonNegativeInt,
} from "./generative-reference-metadata";
import { resolveAiImageReferenceRules } from "./ai-image-reference-policy";
import type { WorkflowNodeType } from "./workflow-types";

describe("parseNonNegativeInt", () => {
  it("preserves zero", () => {
    expect(parseNonNegativeInt("0", 4)).toBe(0);
  });

  it("falls back on invalid input", () => {
    expect(parseNonNegativeInt("abc", 4)).toBe(4);
  });
});

describe("generativeReferenceMetadataForModel", () => {
  it("writes image and video reference snapshots", () => {
    const imageModel: OrgImageModelOption = {
      optionId: buildOrgModelOptionId("iface", "img"),
      canonicalId: "img",
      interfaceId: "iface",
      channelKind: "aggregate",
      alias: "img",
      displayName: "img",
      modality: "image",
      providerModelId: "img",
      parameterRules: {
        schemaVersion: 1,
        maxReferenceImages: 0,
        maxImageReferenceBytes: 1,
        promptMaxChars: 100,
        generationFields: [],
      },
      selectable: true,
      description: "",
      groupId: null,
      groupName: null,
      groupDescription: null,
      groupIcon: null,
    };

    expect(generativeReferenceMetadataForModel("image", imageModel)).toEqual({
      refMaxImages: "0",
    });

    const videoModel: OrgVideoModelOption = {
      optionId: buildOrgModelOptionId("iface", "vid"),
      canonicalId: "vid",
      interfaceId: "iface",
      channelKind: "aggregate",
      alias: "vid",
      displayName: "vid",
      modality: "video",
      providerModelId: "vid",
      parameterRules: {
        ...DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
        maxReferenceVideos: 0,
        generationFields: [
          {
            name: "reference_mode",
            apiName: "",
            type: "string",
            description: "",
            default: "first_last_frame",
            enumValues: ["reference_image", "first_last_frame"],
            clientOnly: true,
          },
        ],
      },
      selectable: true,
      description: "",
      groupId: null,
      groupName: null,
      groupDescription: null,
      groupIcon: null,
    };

    expect(generativeReferenceMetadataForModel("video", videoModel)).toMatchObject(
      {
        refMaxVideos: "0",
        refReferenceMode: "first_last_frame",
      }
    );
  });
});

describe("resolveAiImageReferenceRules", () => {
  it("uses metadata snapshot when catalog is unavailable", () => {
    const nodeData: WorkflowNodeType = {
      nodeType: AI_IMAGE_NODE_TYPE,
      name: "image",
      inputs: [{ id: "model", value: "custom-image" }],
      outputs: [],
      metadata: { refMaxImages: "1" },
    };

    expect(resolveAiImageReferenceRules({ targetNodeData: nodeData }).maxReferenceImages).toBe(
      1
    );
    expect(
      resolveAiImageReferenceRules({ targetNodeData: nodeData }).maxReferenceImages
    ).not.toBe(DEFAULT_IMAGE_MODEL_PARAMETER_RULES.maxReferenceImages);
  });
});

describe("evaluateAiVideoReferenceStructural", () => {
  it("rejects video references when metadata limit is zero", () => {
    const targetNodeData: WorkflowNodeType = {
      nodeType: AI_VIDEO_NODE_TYPE,
      name: "video",
      inputs: [{ id: "model", value: "custom-video" }],
      outputs: [],
      metadata: {
        refMaxImages: "2",
        refMaxVideos: "0",
        refMaxAudios: "0",
        refReferenceMode: "first_last_frame",
      },
    };

    const verdict = evaluateAiVideoReferenceStructural({
      targetNodeId: "video-1",
      sourceNodeId: "video-2",
      sourceHandle: "videos",
      sourceNodeType: AI_VIDEO_NODE_TYPE,
      targetNodeData,
      edges: [],
      nodes: [
        { id: "video-1", data: targetNodeData },
        {
          id: "video-2",
          data: { nodeType: AI_VIDEO_NODE_TYPE, name: "src", inputs: [], outputs: [] },
        },
      ],
    });

    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("video_limit");
  });
});

describe("applyModelBindingToNodeData", () => {
  it("always snapshots video reference metadata", () => {
    const model: OrgVideoModelOption = {
      optionId: buildOrgModelOptionId("iface", "vid"),
      canonicalId: "vid",
      interfaceId: "iface",
      channelKind: "aggregate",
      alias: "vid",
      displayName: "vid",
      modality: "video",
      providerModelId: "vid",
      parameterRules: {
        ...DEFAULT_VIDEO_MODEL_PARAMETER_RULES,
        maxReferenceAudios: 0,
      },
      selectable: true,
      description: "",
      groupId: null,
      groupName: null,
      groupDescription: null,
      groupIcon: null,
    };

    const patch = applyModelBindingToNodeData({
      model,
      current: {
        nodeType: AI_VIDEO_NODE_TYPE,
        name: "video",
        inputs: [],
        outputs: [],
      },
      modality: "video",
      updateWorkflowDefault: false,
      handlers: generativeModelBindingHandlersForModality("video"),
    });

    expect(patch.metadata?.refMaxAudios).toBe("0");
  });
});
