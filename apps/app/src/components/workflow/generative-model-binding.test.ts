import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  AI_VIDEO_NODE_TYPE,
  buildOrgModelOptionId,
  type OrgTextModelOption,
} from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  applyModelBindingToNodeData,
  generativeModelBindingHandlersForModality,
  resolveModelForNewReference,
} from "./generative-model-binding";
import { createProjectedModelFits } from "./generative-model-ref-fit";
import { AI_IMAGE_PROMPT_HANDLE_ID } from "./ai-image-node-utils";
import { AI_TEXT_OUTPUT_ID } from "./ai-text-node-utils";
import type { WorkflowNodeType } from "./workflow-types";

function mockTextModel(
  canonicalId: string,
  rules: Partial<OrgTextModelOption["parameterRules"]> = {},
  interfaceId = "iface-1"
): OrgTextModelOption {
  return {
    optionId: buildOrgModelOptionId(interfaceId, canonicalId),
    canonicalId,
    interfaceId,
    channelKind: "aggregate",
    alias: canonicalId,
    displayName: canonicalId,
    modality: "text",
    providerModelId: canonicalId,
    parameterRules: rules,
    selectable: true,
    description: "",
    groupId: null,
    groupName: null,
    groupDescription: null,
    groupIcon: null,
  };
}

function nodeDataWithModel(model: OrgTextModelOption): WorkflowNodeType {
  return {
    nodeType: AI_TEXT_NODE_TYPE,
    name: "text",
    inputs: [
      { id: "model", value: model.canonicalId },
      { id: "ai_interface_id", value: model.interfaceId },
    ],
    outputs: [],
  };
}

describe("resolveModelForNewReference", () => {
  it("keeps the current model when it already fits projected references", () => {
    const model = mockTextModel("video-capable", { maxVideoReferences: 1 });
    const modelFits = createProjectedModelFits({
      targetType: AI_TEXT_NODE_TYPE,
      connection: {
        source: "video-1",
        sourceHandle: "video",
        target: "text-new",
        targetHandle: "keywords",
      },
      sourceNodeType: AI_VIDEO_NODE_TYPE,
    });

    const result = resolveModelForNewReference({
      models: [model],
      targetNodeData: nodeDataWithModel(model),
      modelFits,
    });

    expect(result).toEqual({
      canConnect: true,
      modelToApply: undefined,
      effectiveModel: model,
    });
  });

  it("auto-switches to the first fitting model when the current model does not fit", () => {
    const current = mockTextModel("no-video", { maxVideoReferences: 0 });
    const replacement = mockTextModel("video-capable", { maxVideoReferences: 1 });
    const modelFits = createProjectedModelFits({
      targetType: AI_TEXT_NODE_TYPE,
      connection: {
        source: "video-1",
        sourceHandle: "video",
        target: "text-new",
        targetHandle: "keywords",
      },
      sourceNodeType: AI_VIDEO_NODE_TYPE,
    });

    const result = resolveModelForNewReference({
      models: [current, replacement],
      targetNodeData: nodeDataWithModel(current),
      modelFits,
    });

    expect(result).toEqual({
      canConnect: true,
      modelToApply: replacement,
      effectiveModel: replacement,
    });
  });

  it("rejects the connection when no model fits projected references", () => {
    const model = mockTextModel("no-video", { maxVideoReferences: 0 });
    const modelFits = createProjectedModelFits({
      targetType: AI_TEXT_NODE_TYPE,
      connection: {
        source: "video-1",
        sourceHandle: "video",
        target: "text-new",
        targetHandle: "keywords",
      },
      sourceNodeType: AI_VIDEO_NODE_TYPE,
    });

    const result = resolveModelForNewReference({
      models: [model],
      targetNodeData: nodeDataWithModel(model),
      modelFits,
    });

    expect(result).toEqual({
      canConnect: false,
      modelToApply: undefined,
      effectiveModel: undefined,
    });
  });
});

describe("applyModelBindingToNodeData", () => {
  it("writes node inputs without updating workflow defaults for auto-switch", () => {
    const model = mockTextModel("video-capable", { maxVideoReferences: 1 });
    const current: WorkflowNodeType = {
      nodeType: AI_TEXT_NODE_TYPE,
      name: "text",
      inputs: [{ id: "model", value: "no-video" }],
      outputs: [],
    };
    let defaultChanged = false;

    const patch = applyModelBindingToNodeData({
      model,
      current,
      modality: "text",
      updateWorkflowDefault: false,
      handlers: generativeModelBindingHandlersForModality("text"),
      onGenerativeDefaultChange: () => {
        defaultChanged = true;
      },
    });

    expect(defaultChanged).toBe(false);
    expect(patch.inputs?.find((input) => input.id === "model")?.value).toBe(
      "video-capable"
    );
    expect(patch.metadata?.refMaxVideo).toBe("1");
  });
});

describe("createProjectedModelFits", () => {
  it("treats prompt-only image connections as fitting any selectable model", () => {
    const modelFits = createProjectedModelFits({
      targetType: AI_IMAGE_NODE_TYPE,
      connection: {
        source: "text-1",
        sourceHandle: AI_TEXT_OUTPUT_ID,
        target: "image-new",
        targetHandle: AI_IMAGE_PROMPT_HANDLE_ID,
      },
      sourceNodeType: AI_TEXT_NODE_TYPE,
    });

    expect(modelFits(mockTextModel("any"))).toBe(true);
  });
});
