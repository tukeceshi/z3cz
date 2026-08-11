import { describe, expect, it } from "vitest";

import type { OrgImageModelOption } from "@dafthunk/types";

import { applyHistoryItemSettingsToNode } from "./apply-history-item-settings";
import type { WorkflowNodeType } from "./workflow-types";

const imageModel: OrgImageModelOption = {
  optionId: "iface:seed-3.0",
  canonicalId: "seed-3.0",
  interfaceId: "iface-1",
  channelKind: "platform",
  alias: "Seed 3.0",
  displayName: "Seed 3.0",
  modality: "image",
  providerModelId: "doubao-seed-3-0",
  parameterRules: {
    schemaVersion: 1,
    referenceInputs: [],
    maxReferenceImages: 0,
    generationFields: [
      {
        key: "ratio",
        type: "enum",
        label: "Ratio",
        options: [{ value: "16:9", label: "16:9" }],
        defaultValue: "16:9",
      },
    ],
  },
  selectable: true,
  description: "",
  sortOrder: 0,
  brandIcon: "sparkles",
};

function baseNode(): WorkflowNodeType {
  return {
    name: "Image",
    nodeType: "ai-image",
    inputs: [
      { id: "model", name: "model", type: "string", value: "other-model" },
      {
        id: "ai_interface_id",
        name: "ai_interface_id",
        type: "string",
        value: "iface-old",
      },
      { id: "params", name: "params", type: "json", value: { ratio: "1:1" } },
    ],
    outputs: [],
    executionState: "idle",
  };
}

describe("applyHistoryItemSettingsToNode", () => {
  it("binds live model and sanitizes history params", () => {
    const result = applyHistoryItemSettingsToNode({
      current: baseNode(),
      modality: "image",
      models: [imageModel],
      historyBinding: {
        platformModelId: "seed-3.0",
        aiInterfaceId: "iface-1",
      },
      historyParams: { ratio: "16:9", unknown: "drop-me" },
    });

    expect(result.modelUnavailable).toBe(false);
    expect(
      result.patch.inputs?.find((input) => input.id === "model")?.value
    ).toBe("seed-3.0");
    expect(result.patch.metadata?.refMaxImages).toBe("0");
    expect(
      result.patch.inputs?.find((input) => input.id === "params")?.value
    ).toEqual({ ratio: "16:9" });
  });

  it("sanitizes params against the current model when history model is unavailable", () => {
    const current: WorkflowNodeType = {
      ...baseNode(),
      inputs: [
        { id: "model", name: "model", type: "string", value: "seed-3.0" },
        {
          id: "ai_interface_id",
          name: "ai_interface_id",
          type: "string",
          value: "iface-1",
        },
        { id: "params", name: "params", type: "json", value: { ratio: "1:1" } },
      ],
    };

    const result = applyHistoryItemSettingsToNode({
      current,
      modality: "image",
      models: [imageModel],
      historyBinding: {
        platformModelId: "missing-model",
        aiInterfaceId: "iface-1",
      },
      historyParams: { ratio: "16:9" },
    });

    expect(result.modelUnavailable).toBe(true);
    expect(
      result.patch.inputs?.find((input) => input.id === "model")?.value
    ).toBe("seed-3.0");
    expect(
      result.patch.inputs?.find((input) => input.id === "params")?.value
    ).toEqual({ ratio: "16:9" });
  });
});
