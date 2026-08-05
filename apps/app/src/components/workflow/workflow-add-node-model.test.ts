import {
  AI_IMAGE_NODE_TYPE,
  AI_TEXT_NODE_TYPE,
  buildOrgModelOptionId,
  type OrgTextModelOption,
} from "@dafthunk/types";
import type { Node as ReactFlowNode } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { AI_TEXT_KEYWORDS_HANDLE_ID } from "./ai-text-node-utils";
import {
  applyModelBindingToNodeData,
  generativeModelBindingHandlersForModality,
  resolveModelForNewReference,
} from "./generative-model-binding";
import { createProjectedModelFits } from "./generative-model-ref-fit";
import { validateWorkflowConnection } from "./workflow-connection-validation";
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

function makeFlowNode(
  id: string,
  data: WorkflowNodeType
): ReactFlowNode<WorkflowNodeType> {
  return {
    id,
    position: { x: 0, y: 0 },
    data,
  };
}

describe("add-node reference model before validation", () => {
  it("rejects image→text on default model before binding, passes after auto-switch metadata", () => {
    const current = mockTextModel("deepseek-v4-pro", { maxImageReferences: 0 });
    const replacement = mockTextModel("doubao-seed-evolving", {
      maxImageReferences: 10,
    });
    const models = [current, replacement];
    const connection = {
      source: "image-1",
      sourceHandle: "images",
      target: "text-new",
      targetHandle: AI_TEXT_KEYWORDS_HANDLE_ID,
    };
    const modelFits = createProjectedModelFits({
      targetType: AI_TEXT_NODE_TYPE,
      connection,
      sourceNodeType: AI_IMAGE_NODE_TYPE,
    });

    const defaultNodeData: WorkflowNodeType = {
      nodeType: AI_TEXT_NODE_TYPE,
      name: "text-new",
      inputs: [
        { id: "model", value: current.canonicalId },
        { id: "ai_interface_id", value: current.interfaceId },
      ],
      outputs: [{ id: "text", name: "text", type: "string" }],
    };

    const nodesBeforeSwitch = [
      makeFlowNode("image-1", {
        nodeType: AI_IMAGE_NODE_TYPE,
        name: "Image 1",
        inputs: [],
        outputs: [{ id: "images", name: "images", type: "image" }],
      }),
      makeFlowNode("text-new", defaultNodeData),
    ];

    expect(
      validateWorkflowConnection({
        connection,
        nodes: nodesBeforeSwitch,
        edges: [],
      })
    ).toBe(false);

    const resolution = resolveModelForNewReference({
      models,
      targetNodeData: defaultNodeData,
      modelFits,
    });
    expect(resolution.modelToApply).toBe(replacement);

    const bindingPatch = applyModelBindingToNodeData({
      model: resolution.effectiveModel!,
      current: defaultNodeData,
      modality: "text",
      updateWorkflowDefault: false,
      handlers: generativeModelBindingHandlersForModality("text"),
    });
    const preparedNodeData: WorkflowNodeType = {
      ...defaultNodeData,
      ...bindingPatch,
      metadata: {
        ...(defaultNodeData.metadata ?? {}),
        ...(bindingPatch.metadata ?? {}),
      },
      inputs: bindingPatch.inputs ?? defaultNodeData.inputs,
    };

    const nodesAfterSwitch = [
      nodesBeforeSwitch[0]!,
      makeFlowNode("text-new", preparedNodeData),
    ];

    expect(
      validateWorkflowConnection({
        connection,
        nodes: nodesAfterSwitch,
        edges: [],
      })
    ).toBe(true);
    expect(preparedNodeData.metadata?.refMaxImage).toBe("10");
  });
});
