import type { OrgTextModelOption } from "@dafthunk/types";
import { buildOrgModelOptionId } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import { sortModelsForPicker } from "./ai-text-model-picker";

function mockModel(
  canonicalId: string,
  sortOrder: number,
  interfaceId = "iface-1"
): OrgTextModelOption {
  return {
    optionId: buildOrgModelOptionId(interfaceId, canonicalId),
    instanceId: canonicalId,
    canonicalId,
    interfaceId,
    channelKind: "aggregate",
    alias: canonicalId,
    displayName: canonicalId,
    modality: "text",
    providerModelId: canonicalId,
    parameterRules: {
      schemaVersion: 1,
      referenceInputs: [],
      keywordsMaxChars: 1000,
      promptMaxChars: 1000,
      outputMaxTokens: 1000,
      outputMaxTokensLimit: 1000,
      outputMaxChars: 1000,
      contextWindowTokens: 1000,
      maxTextReferences: 0,
      maxTextReferenceChars: 1000,
      maxImageReferences: 0,
      maxImageReferenceBytes: 1000,
      maxVideoReferences: 0,
      maxVideoReferenceBytes: 1000,
      maxVideoReferenceSeconds: 1000,
    },
    selectable: true,
    description: "",
    sortOrder,
    brandIcon: null,
  };
}

describe("ai-text-model-picker", () => {
  it("sorts models by sortOrder then display name", () => {
    const sorted = sortModelsForPicker([
      mockModel("seed-1", 30),
      mockModel("claude-opus", 10),
      mockModel("claude-sonnet", 20),
      mockModel("solo", 40),
    ]);

    expect(sorted.map((model) => model.canonicalId)).toEqual([
      "claude-opus",
      "claude-sonnet",
      "seed-1",
      "solo",
    ]);
  });

  it("does not mutate the input array", () => {
    const models = [mockModel("seed-1", 30), mockModel("claude-sonnet", 20)];
    const snapshot = [...models];

    sortModelsForPicker(models);

    expect(models).toEqual(snapshot);
  });
});
